import { ImageSearchSort } from '../../../common/src/Types'
import Db, { OrderBy, WhereRaw } from '../Db'

const TABLE = 'images'

export interface ImageRow {
  id: number
  uploader_user_id: number
  uploader_user_name: string
  created: Date
  filename: string
  filename_original: string
  title: string
  width: number
  height: number
  private: number
  copyright_name: string
  copyright_url: string
}

export interface ImageXTagRow {
  image_id: number
  category_id: number
}

export interface TagRow {
  id: number
  slug: string
  title: string
}

export interface TagRowWithCount extends TagRow {
  images_count: number
}

export interface ImageRowWithCount extends ImageRow {
  games_count: number
}

export class ImagesRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async get(where: WhereRaw): Promise<ImageRow | null> {
    return await this.db.get(TABLE, where)
  }

  async insert(image: Partial<ImageRow>): Promise<number> {
    return await this.db.insert(TABLE, image, 'id') as number
  }

  async update(image: Partial<ImageRow>, where: WhereRaw): Promise<void> {
    await this.db.update(TABLE, image, where)
  }

  async deleteTagRelations(imageId: number): Promise<void> {
    await this.db.delete('image_x_category', { image_id: imageId })
  }

  async insertTagRelation(imageXtag: ImageXTagRow): Promise<void> {
    await this.db.insert('image_x_category', imageXtag)
  }

  async upsertTag(tag: Omit<TagRow, 'id'>): Promise<number> {
    return await this.db.upsert('categories', tag, { slug: tag.slug }, 'id')
  }

  async getTagsBySlugs(slugs: string[]): Promise<TagRow[]> {
    return await this.db.getMany('categories', {slug: {'$in': slugs}})
  }

  async getTagsBySearch(search: string): Promise<TagRow[]> {
    return await this.db.getMany('categories', {slug: {'$ilike': search + '%'}})
  }

  async getTagsByImageId(imageId: number): Promise<TagRow[]> {
    const query = `
      select c.id, c.slug, c.title from categories c
      inner join image_x_category ixc on c.id = ixc.category_id
      where ixc.image_id = $1`
    return await this.db._getMany(query, [imageId])
  }

  async searchImagesWithCount(
    search: string,
    orderBy: string,
    isPrivate: boolean,
    offset: number,
    limit: number,
    userId: number,
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

    const imageIds: number[] = []
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
          const ids: number[] = (await this.db._getMany(`
      select i.id from image_x_category ixc
      inner join images i on i.id = ixc.image_id ${where.sql};
      `, where.values)).map(img => img.id)
          imageIds.push(...ids)
        }
      }
    }

    const params: (string|number)[] = [userId]
    const ors: string[] = []
    if (imageIds.length > 0) {
      ors.push(`images.id IN (${imageIds.join(',')})`)
    }
    if (searches.length) {
      let i = 2
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
        (private = ${isPrivate ? 1 : 0} OR images.uploader_user_id = $1)
        ${ors.length > 0 ? ` AND (${ors.join(' OR ')})` : ''}
      ${this.db._buildOrderBy(orderByMap[orderBy])}
      ${this.db._buildLimit({ offset, limit })}
    `, params)
  }

  async getGameCount(imageId: number): Promise<number> {
    const rows = await this.getImagesWithCountByIds([imageId])
    return rows.length > 0 ? rows[0].games_count : 0
  }

  async getImagesWithCountByIds(imageIds: number[]): Promise<ImageRowWithCount[]> {
    const params: any[] = []
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
}
