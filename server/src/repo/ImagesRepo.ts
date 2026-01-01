import { ImageSearchSort } from '@common/Types'
import type { ImageId, ImageRow, ImageRowWithCount, ImageXTagRow, TagId, TagRow, TagRowWithCount, UserId } from '@common/Types'
import type Db from '../lib/Db'
import type { OrderBy, WhereRaw } from '../lib/Db'
import DbData from '../app/DbData'

export class ImagesRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async get(where: WhereRaw): Promise<ImageRow | null> {
    return await this.db.get(DbData.Tables.Images, where)
  }

  async getMany(where: WhereRaw): Promise<ImageRow[]> {
    return await this.db.getMany(DbData.Tables.Images, where)
  }

  async getManyByIds(ids: ImageId[]): Promise<ImageRow[]> {
    if (ids.length === 0) {
      return []
    }
    return await this.db.getMany(DbData.Tables.Images, { id: { '$in': ids } })
  }

  async count(): Promise<number> {
    return await this.db.count(DbData.Tables.Images)
  }

  async countPublicByUser(userId: UserId): Promise<number> {
    return await this.db.count(DbData.Tables.Images, {
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
      rawWhere['t.slug'] = { '$in': filter.tags }
      joins = `
        INNER JOIN ${DbData.Tables.ImageXTag} ixt ON ixt.image_id = i.id
        INNER JOIN ${DbData.Tables.Tags} t ON t.id = ixt.category_id
      `
    }

    if (filter.ids.length > 0) {
      rawWhere['i.id'] = { '$in': filter.ids }
    }

    const where = this.db._buildWhere(rawWhere)
    return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          image_id
        FROM
          ${DbData.Tables.Games}
        GROUP BY image_id
      )
      SELECT
        i.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(u.name, '') AS uploader_user_name
      FROM ${DbData.Tables.Images} i
        LEFT JOIN counts ON counts.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
        ${joins}
      ${where.sql}
      ORDER BY i.id DESC
      ${this.db._buildLimit({ offset, limit })};
    `, where.values)
  }

  async delete(imageId: ImageId): Promise<void> {
    await this.db.delete(DbData.Tables.Images, { id: imageId })
  }

  async insert(image: Omit<ImageRow, 'id'>): Promise<ImageId> {
    return await this.db.insert(DbData.Tables.Images, image, 'id') as ImageId
  }

  async update(image: Partial<ImageRow>, where: WhereRaw): Promise<void> {
    await this.db.update(DbData.Tables.Images, image, where)
  }

  async deleteTagRelations(imageId: ImageId): Promise<void> {
    await this.db.delete(DbData.Tables.ImageXTag, { image_id: imageId })
  }

  async insertTagRelation(imageXtag: ImageXTagRow): Promise<void> {
    await this.db.insert(DbData.Tables.ImageXTag, imageXtag)
  }

  async upsertTag(tag: Omit<TagRow, 'id'>): Promise<TagId> {
    return await this.db.upsert(DbData.Tables.Tags, tag, ['slug'], 'id')
  }

  async getTagsBySlugs(slugs: string[]): Promise<TagRow[]> {
    return await this.db.getMany(DbData.Tables.Tags, {slug: {'$in': slugs}})
  }

  async getTagsBySearch(search: string): Promise<TagRow[]> {
    return await this.db.getMany(DbData.Tables.Tags, {slug: {'$ilike': search + '%'}})
  }

  async getImageIdsByTags(tags: TagRow[]): Promise<ImageId[]> {
    if (!tags.length) {
      return []
    }

    const where = this.db._buildWhere({
      'category_id': {'$in': tags.map(x => x.id)},
    })
    const rows = await this.db._getMany<{ id: ImageId }>(`
      select i.id
      from ${DbData.Tables.ImageXTag} ixc
      inner join ${DbData.Tables.Images} i on i.id = ixc.image_id
      ${where.sql};
    `, where.values)

    return rows.map(img => img.id)
  }

  async getTagsByImageIds(imageIds: ImageId[]): Promise<Record<ImageId, TagRow[]>> {
    const where = this.db._buildWhere({'i.id': { '$in': imageIds }})
    const query = `
      select i.id as image_id, json_agg(t.*) as tags
      from ${DbData.Tables.Tags} t
      inner join ${DbData.Tables.ImageXTag} ixc on t.id = ixc.category_id
      inner join ${DbData.Tables.Images} i on i.id = ixc.image_id
      ${where.sql}
      group by i.id
    `
    const rows = await this.db._getMany<{
      image_id: ImageId,
      tags: TagRow[]
    }>(query, where.values)
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
        const imageIdsByTags = await this.getImageIdsByTags(tags)
        imageIds.push(...imageIdsByTags)
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
      ors.push(`i.id IN (${imageIds.join(',')})`)
    }
    if (searches.length) {
      for (search of searches) {
        ors.push(`u.name ilike $${i++}`)
        params.push(`%${search}%`)
        ors.push(`i.title ilike $${i++}`)
        params.push(`%${search}%`)
        ors.push(`i.copyright_name ilike $${i++}`)
        params.push(`%${search}%`)
      }
    }

    return await this.db._getMany<ImageRowWithCount>(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          g.image_id
        FROM
          ${DbData.Tables.Games} g
        WHERE
          g.private = ${isPrivate ? 1 : 0}
        GROUP BY g.image_id
      )
      SELECT
        i.*,
        COALESCE(c.count, 0) AS games_count,
        COALESCE(u.name, '') as uploader_user_name
      FROM
        ${DbData.Tables.Images} i
        LEFT JOIN counts c ON c.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
      WHERE
        (
          i.private = ${isPrivate ? 1 : 0}
          ${currentUserId ? `OR i.uploader_user_id = $${idxCurrentUserId}` : ''}
        )
        ${limitToUserId ? ` AND i.uploader_user_id = $${idxLimitToUserId}` : ''}
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
    const dbWhere = this.db._buildWhere({'i.id': { '$in': imageIds }})
    params.push(...dbWhere.values)
    return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          g.image_id
        FROM
          ${DbData.Tables.Games} g
        WHERE
          g.private = 0
        GROUP BY g.image_id
      )
      SELECT
        i.*,
        COALESCE(c.count, 0) AS games_count,
        COALESCE(u.name, '') as uploader_user_name
      FROM
        ${DbData.Tables.Images} i
        LEFT JOIN counts c ON c.image_id = i.id
        LEFT JOIN ${DbData.Tables.Users} u ON u.id = i.uploader_user_id
      ${dbWhere.sql}
    `, params)
  }

  async getAllTagsWithCount(): Promise<TagRowWithCount[]> {
    const query = `
      select t.id, t.slug, t.title, count(*)::int as images_count
      from ${DbData.Tables.Tags} t
      inner join ${DbData.Tables.ImageXTag} ixc on t.id = ixc.category_id
      inner join ${DbData.Tables.Images} i on i.id = ixc.image_id
      group by t.id order by images_count desc;`
    return await this.db._getMany(query)
  }

  async reportImage(imageId: ImageId): Promise<void> {
    await this.db.run(`UPDATE ${DbData.Tables.Images} SET reported = reported + 1 WHERE id = $1`, [imageId])
  }
}
