import { BasePageReq, BasePageResp } from '@/modules/common/dto/common.dto'
import { PrismaService } from '@/modules/common/services/prisma.service'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { Post, PostIndex, Prisma } from '@prisma/client'
import { randomInt, randomUUID } from 'crypto'
import { MediaItem, TweetItem, TweetPageReq, TweetRetweetResp, TweetVoteResp } from '../controllers/tweet.dto'
import { CommentLevelEnum, FriendStatusEnum, TweetRetweetTypeEnum, TweetStatusEnum, VisibleTypeEnum } from '@/enums'
import commonUtil from '@/utils/common.util'
import { UserService } from '@/modules/user/services/user.service'
import { id } from 'ethers'

@Injectable()
export class TweetService {
  constructor (
    private readonly prisma: PrismaService,
    private readonly userService: UserService
  ) {}

  async create (data: Prisma.PostCreateInput): Promise<Post> {
    const post = await this.prisma.post.create({ data })
    const index: Prisma.PostIndexCreateInput = {
      randomSort: this.randomSort(),
      overall: 0,
      voteCount: 0,
      commentCount: 0,
      retweetCount: 0,
      readCount: 0,
      redditValue: 0,
      status: 0,
      visibleType: post.visibleType,
      retweetId: post.retweetId,
      retweetType: post.retweetType,
      post: {
        connect: {
          id: post.id
        }
      }
    }

    await this.prisma.postIndex.create({ data: index })
    return post
  }

  /**
   * 根据热度分页排序
   *  1.推文可见权限设置
   *  2.根据overall 分值排序
   * @param currentUserId
   * @param param
   */
  async queryByIndex (currentUserId: string, param: TweetPageReq): Promise<BasePageResp<Post>> {
    const friendIds = await this.findFriendId(currentUserId)
    const where: Prisma.PostWhereInput = {
      OR: [
        { visibleType: VisibleTypeEnum.PUBLIC },
        { visibleType: VisibleTypeEnum.FRIEND, authorId: { in: friendIds } },
        { visibleType: VisibleTypeEnum.SELF, authorId: currentUserId }
      ],
      status: TweetStatusEnum.NORMAL
    }
    const result = await this.prisma.post.findMany({
      where,
      skip: commonUtil.pageSkip(param),
      take: param.limit,
      include: {
        postIndex: {
          select: {
            overall: true
          }
        }
      },
      orderBy: [
        {
          postIndex: {
            overall: 'desc'
          }
        },
        {
          createdAt: 'desc'
        }
      ]
    })
    const total = await this.prisma.post.count({
      where
    })
    return new BasePageResp(param, result, total)
  }

  /**
   * 好友的推文
   *  不包含自己
   *  不包含路人
   * @param currentUserId
   * @param param
   */
  async queryByFriend (currentUserId: string, param: TweetPageReq): Promise<BasePageResp<Post>> {
    const friendIds = await this.findFriendId(currentUserId)
    const where: Prisma.PostWhereInput = {
      visibleType: { in: [VisibleTypeEnum.PUBLIC, VisibleTypeEnum.FRIEND] },
      authorId: { in: friendIds },
      status: TweetStatusEnum.NORMAL
    }
    const result = await this.prisma.post.findMany({
      where,
      skip: commonUtil.pageSkip(param),
      take: param.limit,
      orderBy: [{
        postIndex: {
          overall: 'desc'
        }
      },
      { createdAt: 'desc' }
      ]
    })
    const total = await this.prisma.post.count({
      where
    })
    return new BasePageResp(param, result, total)
  }

  /**
   * 我自己的推文
   * @param currentUserId
   * @param param
   */
  async queryByMine (currentUserId: string, param: TweetPageReq): Promise<BasePageResp<Post>> {
    const where: Prisma.PostWhereInput = {
      authorId: currentUserId,
      status: TweetStatusEnum.NORMAL
    }
    const result = await this.prisma.post.findMany({
      where,
      skip: commonUtil.pageSkip(param),
      take: param.limit,
      orderBy: {
        createdAt: 'desc'
      }
    })
    const total = await this.prisma.post.count({
      where
    })
    return new BasePageResp(param, result, total)
  }

  /**
   * 评论列表 根据时间倒序
   * @param tweetId
   * @param page
   */
  async findCommentsPage (tweetId: string, page: BasePageReq): Promise<BasePageResp<Post>> {
    const result = await this.prisma.post.findMany({
      where: {
        retweetId: tweetId,
        retweetType: TweetRetweetTypeEnum.COMMENT,
        // todo 这里要有好友的权限判断
        visibleType: { in: [VisibleTypeEnum.PUBLIC] }
      },
      skip: commonUtil.pageSkip(page),
      take: page.limit,
      orderBy: {
        createdAt: 'desc'
      }
    })
    const total = await this.prisma.post.count({
      where: {
        retweetId: tweetId,
        retweetType: TweetRetweetTypeEnum.COMMENT
      }
    })
    return new BasePageResp(page, result, total)
  }

  /**
   * 推文转dto
   * @param currentUserId
   * @param data post data
   */
  async tweetItemChange (currentUserId: string, data: Post[]): Promise<TweetItem[]> {
    const ids = data.map(d => { return d.id })
    const authorIds: Set<string> = new Set<string>(data.map(d => { return d.authorId }))
    const userHash = await this.userService.userHash(Array.from(authorIds))
    const postIndexHash = await this.postIndexHash(ids)
    const myVoteSet = await this.voteSet(currentUserId, ids)
    const myRetweetSet = await this.retweetSet(currentUserId, ids)
    const result = data.map(d => {
      const authorId = d.authorId
      const author = commonUtil.hashValueDefault(authorId, userHash, this.userService.defaultUserItem)
      const index: PostIndex = commonUtil.hashValueDefault(d.id, postIndexHash, {
        id: randomUUID(),
        tweetId: d.id,
        randomSort: this.randomSort(),
        overall: 0,
        voteCount: 0,
        commentCount: 0,
        retweetCount: 0,
        readCount: 0,
        redditValue: 0,
        status: 0,
        visibleType: VisibleTypeEnum.PUBLIC,
        retweetId: d.retweetId,
        retweetType: d.retweetType,
        createdAt: d.createdAt,
        parentId: null
      })
      const voteFlag = myVoteSet.has(d.id)
      const retweetFlag = myRetweetSet.has(d.id)
      const dto: TweetItem = {
        authorId,
        authorName: author.name,
        authorAvatar: author.avatar,
        createdAt: d.createdAt,
        medias: this.mediaEntity2Dto(d.medias),
        commentLevel: d.commentLevel,
        longitude: d.longitude,
        latitude: d.latitude,
        address: d.address,
        content: d.content,
        voteCount: voteFlag ? index.voteCount - 1 : index.voteCount,
        voteFlag,
        retweetFlag,
        retweetCount: retweetFlag ? index.retweetCount - 1 : index.retweetCount,
        commentCount: index.commentCount,
        readCount: index.readCount,
        score: index.overall,
        retweetId: d.retweetId
      }
      return dto
    })
    return result.filter(r => commonUtil.notNull(r))
  }

  /**
   * findPostIndex
   * @param tweetIds
   * @returns
   */
  async postIndexHash (tweetIds: string[]): Promise<Map<string, PostIndex>> {
    const postIndex = await this.prisma.postIndex.findMany({
      where: { tweetId: { in: tweetIds } }
    })
    const result: Map<string, PostIndex> = new Map<string, PostIndex>()
    postIndex.forEach(p => {
      result.set(p.tweetId, p)
    })
    return result
  }

  /**
   * vote点赞set
   * @param currentUserId
   * @param tweetIds
   */
  async voteSet (currentUserId: string, tweetIds: string[]): Promise<Set<string>> {
    const myVotes = await this.prisma.postVote.findMany({
      where: { uid: currentUserId, tweetId: { in: tweetIds } },
      select: { tweetId: true }
    })

    return new Set<string>(myVotes.map(v => v.tweetId))
  }

  /**
   * 点赞与取消
   * @param currentUserId
   * @param tweetIds
   */

  async doVote (currentUserId: string, tweetId: string): Promise<TweetVoteResp> {
    const has = await this.prisma.postVote.count({
      where: { uid: currentUserId, tweetId }
    }) > 0
    if (has) {
      await this.prisma.postVote.deleteMany({
        where: { uid: currentUserId, tweetId }
      })
    } else {
      await this.prisma.postVote.create({
        data: { uid: currentUserId, tweetId }
      })
    }
    return { voteFlag: !has }
  }

  /**
   * 转帖统计
   * @param currentUserId
   * @param tweetIds
   * @returns
   */
  async retweetSet (currentUserId: string, tweetIds: string[]): Promise<Set<string>> {
    const myRetweets = await this.prisma.postRetweet.findMany({
      where: { uid: currentUserId, tweetId: { in: tweetIds } },
      select: { tweetId: true }
    })
    return new Set<string>(myRetweets.map(v => v.tweetId))
  }

  /**
   * 转帖与取消
   * @param currentUserId
   * @param tweetId
   */
  async doRetweet (currentUserId: string, tweetId: string): Promise<TweetRetweetResp> {
    const has = await this.prisma.postRetweet.count({
      where: { uid: currentUserId, tweetId }
    }) > 0
    if (has) {
      await this.prisma.postRetweet.deleteMany({
        where: { uid: currentUserId, tweetId }
      })
    } else {
      await this.prisma.postRetweet.create({
        data: { uid: currentUserId, tweetId }
      })
    }
    return { retweetFlag: !has }
  }

  /**
   * 获取好友id
   *  与uid是互相关注的关系
   *  并去除黑名单的干扰
   * @param uid
   */
  async findFriendId (uid: string): Promise<string[]> {
    const myList = await this.prisma.friend.findMany({
      where: {
        uid,
        status: FriendStatusEnum.NORMAL
      },
      select: {
        objUid: true
      }
    })
    const friendList = await this.prisma.friend.findMany({
      where: {
        uid: { in: myList.map(u => u.objUid) },
        objUid: uid,
        status: FriendStatusEnum.NORMAL
      },
      select: {
        uid: true
      }
    })
    return friendList.map(u => u.uid)
  }

  /**
   * 可评论检查
   * @param uid
   * @param tweetId
   */
  async checkCommentLevelById (uid: string, tweetId: string | null): Promise<void> {
    if (tweetId === null) {
      throw new HttpException('不可评论', HttpStatus.BAD_REQUEST)
    }
    const data = await this.prisma.post.findFirstOrThrow({
      where: { id: tweetId },
      select: {
        commentLevel: true,
        authorId: true
      }
    })
    if (data.commentLevel === CommentLevelEnum.NONE) {
      throw new HttpException('不可评论', HttpStatus.BAD_REQUEST)
    }

    if (data.commentLevel === CommentLevelEnum.FRIEND) {
      if (uid !== data.authorId) {
        const count = await this.prisma.friend.count({
          where: {
            uid: { in: [uid, data.authorId] },
            objUid: { in: [uid, data.authorId] }
          }
        })
        if (count < 2) {
          throw new HttpException('不可评论 非好友', HttpStatus.BAD_REQUEST)
        }
      }
    }
  }

  mediaEntity2Dto (data: Prisma.JsonValue[]): MediaItem[] {
    return data.map(d => {
      const item: MediaItem = JSON.parse(JSON.stringify(d))
      return item
    })
  }

  randomSort (): number {
    return randomInt(1000000)
  }
}
