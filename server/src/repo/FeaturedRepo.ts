import type {
  CollectionRow,
  CollectionRowWithImages,
  FeaturedId,
  FeaturedRow,
  FeaturedRowWithCollections,
  FeaturedTeaserRow,
  ImageInfo,
} from '@common/Types'
import type Db from '../Db'
import type { WhereRaw } from '../Db'
import type { Server } from '../Server'

const TABLE = 'featured'

export class FeaturedRepo {
  private server!: Server
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  init(server: Server) {
    this.server = server
  }

  async count(): Promise<number> {
    return await this.db.count(TABLE)
  }

  async get(where: WhereRaw): Promise<FeaturedRow> {
    return await this.db.get(TABLE, where)
  }

  async getMany(where: WhereRaw): Promise<FeaturedRow[]> {
    return await this.db.getMany(TABLE, where)
  }

  async update(featured: Partial<FeaturedRow>, where: WhereRaw): Promise<void> {
    if (featured.links) {
      return await this.db.update(TABLE, {
        ...featured,
        // json stringify, because postgres lib cannot handle array json input
        links: JSON.stringify(featured.links),
      }, where)
    }
    return await this.db.update(TABLE, featured, where)
  }

  public async getManyWithCollections(where: WhereRaw): Promise<FeaturedRowWithCollections[]> {
    const featureds = await this.getMany(where)
    if (featureds.length === 0) {
      return []
    }
    const ids = featureds.map(f => f.id)
    const featuredXCollection = await this.db.getMany(
      'featured_x_collection',
      { featured_id: { $in: ids } },
    )

    const collections: CollectionRow[] = featuredXCollection.length === 0 ? [] : await this.db.getMany(
      'collection',
      { id: { '$in': featuredXCollection.map(x => x.collection_id) } },
    )

    const collectionXImage = collections.length === 0 ? [] : await this.db.getMany(
      'collection_x_image',
      { collection_id: { '$in': collections.map(x => x.id) } },
    )
    const images = await this.server.images.imagesByIdsFromDb(collectionXImage.map(x => x.image_id))

    const collectionsWithImages: CollectionRowWithImages[] = featuredXCollection.toSorted((a, b) => a.sort_index - b.sort_index).map(fxc => {
      const collection = collections.find(c => c.id === fxc.collection_id) as CollectionRow
      const imgs = collectionXImage
        .filter(cxi => cxi.collection_id === collection.id)
        .toSorted((a, b) => a.sort_index - b.sort_index)
        .map(cxi => {
          return images.find(i => i.id === cxi.image_id)
        }) as ImageInfo[]
      return {
        ...collection,
        images: imgs,
      }
    })

    const featuredWithCollections: FeaturedRowWithCollections[] = featureds.map(f => {
      const collectionIds = featuredXCollection.filter(fxc => fxc.featured_id === f.id).map(fxc => fxc.collection_id)
      return {
        ...f,
        collections: collectionsWithImages.filter(c => collectionIds.includes(c.id)),
      }
    })
    return featuredWithCollections
  }

  public async getWithCollections(where: WhereRaw): Promise<FeaturedRowWithCollections> {
    const many = await this.getManyWithCollections(where)
    if (many.length === 0) {
      throw new Error('not found')
    }
    return many[0]
  }

  async insert(featured: Omit<FeaturedRow, 'id'>): Promise<FeaturedId> {
    return await this.db.insert(TABLE, {
      ...featured,
      // always overwrite the creation date to the current time
      created: new Date(),
      // json stringify, because postgres lib cannot handle array json input
      links: JSON.stringify(featured.links),
    }, 'id') as FeaturedId
  }

  async updateWithCollections(featured: FeaturedRowWithCollections): Promise<void> {
    await this.db.delete('featured_x_collection', { featured_id: featured.id })
    let collectionIndex = 0
    for (const collection of featured.collections) {
      if (!collection.id) {
        collection.id = await this.db.insert('collection', {
          created: collection.created,
          name: collection.name,
        }, 'id') as number
      } else {
        await this.db.update('collection', { name: collection.name }, { id: collection.id })
        await this.db.delete('collection_x_image', { collection_id: collection.id })
      }

      let imageIndex = 0
      for (const image of collection.images) {
        await this.db.insert('collection_x_image', {
          collection_id: collection.id,
          image_id: image.id,
          sort_index: imageIndex++,
        })
      }

      await this.db.insert('featured_x_collection', {
        featured_id: featured.id,
        collection_id: collection.id,
        sort_index: collectionIndex++,
      })
    }
    await this.update({
      introduction: featured.introduction,
      links: featured.links,
      name: featured.name,
      slug: featured.slug,
      type: featured.type,
    }, { id: featured.id })
  }

  public async getActiveTeasers(): Promise<FeaturedRowWithCollections[]> {
    const featuredTeaserRows = await this.db.getMany('featured_teaser', { active: 1 })
    const ids = featuredTeaserRows.map(r => r.featured_id)
    const featuredRows = await this.getManyWithCollections({ id: { $in: ids } })
    // sort by property sort_index, ascending:
    return featuredRows.toSorted((a, b) => {
      const teaserA = featuredTeaserRows.find(r => r.featured_id === a.id)!
      const teaserB = featuredTeaserRows.find(r => r.featured_id === b.id)!
      return teaserA!.sort_index - teaserB!.sort_index
    })
  }

  public async getAllTeasers(): Promise<FeaturedTeaserRow[]> {
    return await this.db.getMany('featured_teaser')
  }

  public async saveTeasers(featuredTeasers: FeaturedTeaserRow[]): Promise<void> {
    await this.db.delete('featured_teaser', {})
    await this.db.insertMany('featured_teaser', featuredTeasers.map(teaser => {
      const withoutId: Omit<FeaturedTeaserRow, 'id'> = {
        featured_id: teaser.featured_id,
        sort_index: teaser.sort_index,
        active: teaser.active ? 1 : 0,
      }
      return withoutId
    }))
  }
}
