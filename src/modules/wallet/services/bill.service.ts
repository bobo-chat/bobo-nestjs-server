import { PrismaService } from '@/modules/common/services/prisma.service'
import { Injectable } from '@nestjs/common'
import { BillRecordItem, BillRecordReq } from '../controllers/wallet.dto'
import { BasePageResp } from '@/modules/common/dto/common.dto'
import { Bill, Prisma } from '@prisma/client'
import commonUtil from '@/utils/common.util'
import { BillInOutEnum, BillStatusEnum, BillTypeEnum, BusinessTypeEnum } from '@/enums'

@Injectable()
export class BillService {
  constructor (
    private readonly prisma: PrismaService
  ) {
  }

  async findById (id: string): Promise<Bill> {
    return await this.prisma.bill.findFirstOrThrow({
      where: { id }
    })
  }

  async queryPage (uid: string, param: BillRecordReq): Promise<BasePageResp<Bill>> {
    const pageParam: Prisma.BillFindManyArgs = {
      where: { uid },
      skip: commonUtil.pageSkip(param),
      take: param.limit,
      orderBy: {
        createdAt: 'desc'
      }
    }
    if (param.inOut && param.inOut !== null) {
      pageParam.where = {
        ...pageParam.where,
        inOut: param.inOut
      }
    }
    if (param.type && param.type in BillTypeEnum) {
      pageParam.where = {
        ...pageParam.where,
        type: param.type
      }
    }

    const countParam: Prisma.BillCountArgs = { where: { ...pageParam.where } }
    const data = await this.prisma.bill.findMany(pageParam)
    const total = await this.prisma.bill.count(countParam)
    return new BasePageResp(param, data, total)
  }

  async count (param: Prisma.BillCountArgs): Promise<number> {
    return await this.prisma.bill.count(param)
  }

  async create (uid: string, input: Prisma.BillCreateInput): Promise<Bill> {
    input.uid = uid
    return await this.prisma.bill.create({ data: input })
  }

  // 记录账单
  async createBill (
    uid: string,
    type: BillTypeEnum,
    amount: number,
    inOut: BillInOutEnum,
    status: BillStatusEnum,
    from: string,
    to: string,
    transactionNo: string,
    remark?: string): Promise<Bill> {
    // 使用卡片
    const billInput: Prisma.BillCreateInput = {
      uid,
      type,
      amount,
      inOut,
      status
    }
    const bill = await this.create(uid, billInput)
    const billDetailInput: Prisma.BillDetailCreateInput =
     {
       billId: bill.id,
       uid,
       from,
       to,
       transactionNo,
       remark
     }
    await this.prisma.billDetail.create({ data: billDetailInput })
    return bill
  }

  transferDto (e: Bill): BillRecordItem {
    const item: BillRecordItem = {
      id: e.id,
      type: e.type,
      inOut: e.inOut,
      amount: e.amount,
      status: e.status,
      createdAt: e.createdAt
    }
    return item
  }
}
