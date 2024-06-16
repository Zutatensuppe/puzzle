export class UrlUtil {
  fixUrl(url: string): string {
    if (!url) {
      return url
    }
    if (url.match(/(?:https?:)?\/\//)) {
      return url
    }
    return `https://${url}`
  }
}
