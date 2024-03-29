import { CryptInterceptor } from '@/modules/common/interceptors/crypt.interceptor'
import { UserService } from '../../user/services/user.service'
import { BaseInterceptor } from '@/modules/auth/interceptors/base.interceptor'
import { Body, Controller, Post, Req, UseInterceptors } from '@nestjs/common'
import { Request } from 'express'
import { BaseArrayResp, BaseUIdReq } from '@/modules/common/dto/common.dto'
import { BlockService } from '../../user/services/block.service'
import { BlockInfoItem } from './friend.dto'
import { ResponseInterceptor } from '@/modules/common/interceptors/response.interceptor'

@Controller('auth')
@UseInterceptors(CryptInterceptor, ResponseInterceptor, BaseInterceptor)
export class BlockController {
  constructor (
    private readonly userService: UserService,
    private readonly blockService: BlockService
  ) { }

  // 拉黑
  @Post('add-user-black')
  async addBlock (@Req() req: Request, @Body() param: BaseUIdReq): Promise<void> {
    if (req.uid === param.uid) {
      return
    }
    if (await this.blockService.isBlock(req.uid, param.uid)) {
      return
    }
    await this.blockService.doBlock(req.uid, param.uid)
  }

  // 解除拉黑
  @Post('remove-user-black')
  async removeBlock (@Req() req: Request, @Body() param: BaseUIdReq): Promise<void> {
    await this.blockService.unBlock(req.uid, param.uid)
  }

  // 黑名单列表
  @Post('user-black-list')
  async blockList (@Req() req: Request): Promise<BaseArrayResp<BlockInfoItem>> {
    const list = await this.blockService.findManyByUid(req.uid)
    const data = list.map(i => {
      const dto: BlockInfoItem = {
        uid: i.objUid,
        createdAt: i.createdAt
      }
      return dto
    })
    return { items: data }
  }
}
