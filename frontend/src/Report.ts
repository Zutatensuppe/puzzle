import type { GameId, ImageId, UserId } from '@common/Types'
import _api from './_api'
import type { Response } from './_api/xhr'
import { toast } from './toast'
import type { ReportResponseData } from '@common/TypesApi'

export const submitReport = async (
  request: Promise<Response<ReportResponseData>>,
): Promise<boolean> => {
  const res = await request
  if (res.status === 200) {
    toast('Thank you for your report.', 'success')
    return true
  } else {
    toast('An error occured during reporting.', 'error')
    return false
  }
}

export const submitReportGame = (data: {
  id: GameId
  reason: string
}): Promise<boolean> => {
  return submitReport(_api.pub.reportGame(data))
}

export const submitReportImage = (data: {
  id: ImageId
  reason: string
}): Promise<boolean> => {
  return submitReport(_api.pub.reportImage(data))
}

export const submitReportPlayer = (data: {
  id: UserId
  reason: string
}): Promise<boolean> => {
  return submitReport(_api.pub.reportPlayer(data))
}
