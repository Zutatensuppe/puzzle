import { ImageSearchSort } from '@common/Types'
import type { ImageId, ImageRow, ImageRowWithCount, ImageXTagRow, TagId, TagRow, TagRowWithCount, UserId } from '@common/Types'
import type Db from '../Db'
import type { OrderBy, WhereRaw } from '../Db'

const TABLE = 'images'

export class ImagesRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async get(where: WhereRaw): Promise<ImageRow | null> {
    return await this.db.get(TABLE, where)
  }

  async getMany(where: WhereRaw): Promise<ImageRow[]> {
    return await this.db.getMany(TABLE, where)
  }

  async getManyByIds(ids: ImageId[]): Promise<ImageRow[]> {
    if (ids.length === 0) {
      return []
    }
    return await this.db.getMany(TABLE, { id: { '$in': ids } })
  }

  async count(): Promise<number> {
    return await this.db.count(TABLE)
  }

  async countPublicByUser(userId: UserId): Promise<number> {
    return await this.db.count(TABLE, {
      uploader_user_id: userId,
      private: 0,
    })
  }

  async getWithGameCount(args: {
    offset: number
    limit: number
    filter: {
      ids: ImageId[]
      tags: string[]
    }
  }): Promise<ImageRowWithCount[]> {
    const { offset, limit, filter } = args

    const rawWhere: WhereRaw = {}
    let joins = ''
    if (filter.tags.length > 0) {
      rawWhere['categories.slug'] = { '$in': filter.tags }
      joins = `
        INNER JOIN image_x_category ixt ON ixt.image_id = images.id
        INNER JOIN categories ON categories.id = ixt.category_id
      `
    }

    if (filter.ids.length > 0) {
      rawWhere['images.id'] = { '$in': filter.ids }
    }

    const where = this.db._buildWhere(rawWhere)
    return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          image_id
        FROM
          games
        GROUP BY image_id
      )
      SELECT
        images.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(u.name, '') AS uploader_user_name
      FROM ${TABLE} images
        LEFT JOIN counts ON counts.image_id = images.id
        LEFT JOIN users u ON u.id = images.uploader_user_id
        ${joins}
      ${where.sql}
      ORDER BY images.id DESC
      ${this.db._buildLimit({ offset, limit })};
    `, where.values)
  }

  async delete(imageId: ImageId): Promise<void> {
    await this.db.delete(TABLE, { id: imageId })
  }

  async insert(image: Omit<ImageRow, 'id'>): Promise<ImageId> {
    return await this.db.insert(TABLE, image, 'id') as ImageId
  }

  async update(image: Partial<ImageRow>, where: WhereRaw): Promise<void> {
    await this.db.update(TABLE, image, where)
  }

  async deleteTagRelations(imageId: ImageId): Promise<void> {
    await this.db.delete('image_x_category', { image_id: imageId })
  }

  async insertTagRelation(imageXtag: ImageXTagRow): Promise<void> {
    await this.db.insert('image_x_category', imageXtag)
  }

  async upsertTag(tag: Omit<TagRow, 'id'>): Promise<TagId> {
    return await this.db.upsert('categories', tag, ['slug'], 'id')
  }

  async getTagsBySlugs(slugs: string[]): Promise<TagRow[]> {
    return await this.db.getMany('categories', {slug: {'$in': slugs}})
  }

  async getTagsBySearch(search: string): Promise<TagRow[]> {
    return await this.db.getMany('categories', {slug: {'$ilike': search + '%'}})
  }

  async getTagsByImageIds(imageIds: ImageId[]): Promise<Record<ImageId, TagRow[]>> {
    const where = this.db._buildWhere({'i.id': { '$in': imageIds }})
    const query = `
      select i.id as image_id, json_agg(c.*) as tags from categories c
      inner join image_x_category ixc on c.id = ixc.category_id
      inner join images i on i.id = ixc.image_id
      ${where.sql}
      group by i.id
    `
    const rows = await this.db._getMany(query, where.values)
    const tags: Record<ImageId, TagRow[]> = {}
    for (const row of rows) {
      tags[row.image_id] = row.tags
    }
    return tags
  }

  async searchImagesWithCount(
    search: string,
    orderBy: string,
    isPrivate: boolean,
    offset: number,
    limit: number,
    currentUserId: UserId | null,
    limitToUserId: UserId | null,
  ): Promise<ImageRowWithCount[]> {
    const orderByMap = {
      [ImageSearchSort.ALPHA_ASC]: [{ title: 1 }, { created: -1 }],
      [ImageSearchSort.ALPHA_DESC]: [{ title: -1 }, { created: -1 }],
      [ImageSearchSort.DATE_ASC]: [{ created: 1 }],
      [ImageSearchSort.DATE_DESC]: [{ created: -1 }],
      [ImageSearchSort.GAME_COUNT_ASC]: [{ games_count: 1 }, { created: -1 }],
      [ImageSearchSort.GAME_COUNT_DESC]: [{ games_count: -1 }, { created: -1 }],
    } as Record<string, OrderBy>
    if (!orderByMap[orderBy]) {
      return []
    }

    const imageIds: ImageId[] = []
    // search in tags:
    const searchClean = search.trim()
    const searches = searchClean ? searchClean.split(/\s+/) : []

    if (searches.length > 0) {
      for (search of searches) {
        const tags = await this.getTagsBySearch(search)
        if (tags) {
          const where = this.db._buildWhere({
            'category_id': {'$in': tags.map(x => x.id)},
          })
          const ids: ImageId[] = (await this.db._getMany(`
      select i.id from image_x_category ixc
      inner join images i on i.id = ixc.image_id ${where.sql};
      `, where.values)).map(img => img.id)
          imageIds.push(...ids)
        }
      }
    }

    let i = 1
    let idxCurrentUserId = 0
    const params: (string|number)[] = []
    if (currentUserId) {
      params.push(currentUserId)
      idxCurrentUserId = i
      i++
    }
    let idxLimitToUserId = 0
    if (limitToUserId) {
      params.push(limitToUserId)
      idxLimitToUserId = i
      i++
    }
    const ors: string[] = []
    if (imageIds.length > 0) {
      ors.push(`images.id IN (${imageIds.join(',')})`)
    }
    if (searches.length) {
      for (search of searches) {
        ors.push(`users.name ilike $${i++}`)
        params.push(`%${search}%`)
        ors.push(`images.title ilike $${i++}`)
        params.push(`%${search}%`)
        ors.push(`images.copyright_name ilike $${i++}`)
        params.push(`%${search}%`)
      }
    }

    return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          image_id
        FROM
          games
        WHERE
          private = ${isPrivate ? 1 : 0}
        GROUP BY image_id
      )
      SELECT
        images.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(users.name, '') as uploader_user_name
      FROM
        images
        LEFT JOIN counts ON counts.image_id = images.id
        LEFT JOIN users ON users.id = images.uploader_user_id
      WHERE
        (
          private = ${isPrivate ? 1 : 0}
          ${currentUserId ? `OR images.uploader_user_id = $${idxCurrentUserId}` : ''}
        )
        ${limitToUserId ? ` AND images.uploader_user_id = $${idxLimitToUserId}` : ''}
        ${ors.length > 0 ? ` AND (${ors.join(' OR ')})` : ''}
      ${this.db._buildOrderBy(orderByMap[orderBy])}
      ${this.db._buildLimit({ offset, limit })}
    `, params)
  }

  async getGameCount(imageId: ImageId): Promise<number> {
    const rows = await this.getImagesWithCountByIds([imageId])
    return rows.length > 0 ? rows[0].games_count : 0
  }

  async getImagesWithCountByIds(imageIds: ImageId[]): Promise<ImageRowWithCount[]> {
    const params: unknown[] = []
    const dbWhere = this.db._buildWhere({'images.id': { '$in': imageIds }})
    params.push(...dbWhere.values)
    return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          image_id
        FROM
          games
        WHERE
          private = 0
        GROUP BY image_id
      )
      SELECT
        images.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(users.name, '') as uploader_user_name
      FROM
        images
        LEFT JOIN counts ON counts.image_id = images.id
        LEFT JOIN users ON users.id = images.uploader_user_id
      ${dbWhere.sql}
    `, params)
  }

  async getAllTagsWithCount(): Promise<TagRowWithCount[]> {
    const query = `
      select c.id, c.slug, c.title, count(*)::int as images_count from categories c
      inner join image_x_category ixc on c.id = ixc.category_id
      inner join images i on i.id = ixc.image_id
      group by c.id order by images_count desc;`
    return await this.db._getMany(query)
  }

  async reportImage(imageId: ImageId): Promise<void> {
    await this.db.run(`UPDATE ${TABLE} SET reported = reported + 1 WHERE id = $1`, [imageId])
  }
}
