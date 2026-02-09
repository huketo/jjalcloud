/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util.js'

export const schemaDict = {
  AppBskyActorProfile: {
    defs: {
      main: {
        description: 'A declaration of a Bluesky account profile.',
        key: 'literal:self',
        record: {
          properties: {
            avatar: {
              accept: ['image/png', 'image/jpeg'],
              description:
                "Small image to be displayed next to posts from account. AKA, 'profile picture'",
              maxSize: 1000000,
              type: 'blob',
            },
            banner: {
              accept: ['image/png', 'image/jpeg'],
              description:
                'Larger horizontal image to display behind profile view.',
              maxSize: 1000000,
              type: 'blob',
            },
            createdAt: {
              format: 'datetime',
              type: 'string',
            },
            description: {
              description: 'Free-form profile description text.',
              maxGraphemes: 256,
              maxLength: 2560,
              type: 'string',
            },
            displayName: {
              maxGraphemes: 64,
              maxLength: 640,
              type: 'string',
            },
            joinedViaStarterPack: {
              ref: 'lex:com.atproto.repo.strongRef',
              type: 'ref',
            },
            labels: {
              description:
                'Self-label values, specific to the Bluesky application, on the overall account.',
              refs: ['lex:com.atproto.label.defs#selfLabels'],
              type: 'union',
            },
            pinnedPost: {
              ref: 'lex:com.atproto.repo.strongRef',
              type: 'ref',
            },
            pronouns: {
              description: 'Free-form pronouns text.',
              maxGraphemes: 20,
              maxLength: 200,
              type: 'string',
            },
            website: {
              format: 'uri',
              type: 'string',
            },
          },
          type: 'object',
        },
        type: 'record',
      },
    },
    id: 'app.bsky.actor.profile',
    lexicon: 1,
  },
  ComAtprotoRepoStrongRef: {
    defs: {
      main: {
        properties: {
          cid: {
            format: 'cid',
            type: 'string',
          },
          uri: {
            format: 'at-uri',
            type: 'string',
          },
        },
        required: ['uri', 'cid'],
        type: 'object',
      },
    },
    description: 'A URI with a content-hash fingerprint.',
    id: 'com.atproto.repo.strongRef',
    lexicon: 1,
  },
  ComJjalcloudFeedDefs: {
    lexicon: 1,
    id: 'com.jjalcloud.feed.defs',
    defs: {
      gifView: {
        type: 'object',
        required: ['uri', 'cid', 'author', 'value', 'likeCount', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          author: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
          },
          value: {
            type: 'unknown',
          },
          likeCount: {
            type: 'integer',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  ComJjalcloudFeedGetSearch: {
    lexicon: 1,
    id: 'com.jjalcloud.feed.getSearch',
    defs: {
      main: {
        type: 'query',
        description: 'Search for jjal by tags or titles.',
        parameters: {
          type: 'params',
          properties: {
            q: {
              type: 'string',
              maxLength: 1000,
            },
            limit: {
              type: 'integer',
              default: 50,
              minimum: 1,
              maximum: 100,
            },
            cursor: {
              type: 'string',
              maxLength: 10000,
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['gifs'],
            properties: {
              cursor: {
                type: 'string',
                maxLength: 10000,
              },
              gifs: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.jjalcloud.feed.defs#gifView',
                },
              },
            },
          },
        },
      },
    },
  },
  ComJjalcloudFeedGif: {
    lexicon: 1,
    id: 'com.jjalcloud.feed.gif',
    defs: {
      main: {
        type: 'record',
        description: 'GIF record uploaded by the user',
        key: 'tid',
        record: {
          type: 'object',
          required: ['file', 'createdAt'],
          properties: {
            file: {
              type: 'blob',
              accept: ['image/gif'],
              maxSize: 20000000,
            },
            title: {
              type: 'string',
              maxGraphemes: 100,
              maxLength: 1000,
            },
            alt: {
              type: 'string',
              description: 'Alternative text for accessibility',
              maxGraphemes: 300,
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 100,
              },
              maxLength: 10,
            },
            width: {
              type: 'integer',
              description: 'Width of the GIF in pixels',
            },
            height: {
              type: 'integer',
              description: 'Height of the GIF in pixels',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  ComJjalcloudFeedLike: {
    lexicon: 1,
    id: 'com.jjalcloud.feed.like',
    defs: {
      main: {
        type: 'record',
        description: 'Like reaction to a jjal',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  ComJjalcloudGraphFollow: {
    lexicon: 1,
    id: 'com.jjalcloud.graph.follow',
    defs: {
      main: {
        type: 'record',
        description: 'Follow relationship in jjalcloud',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'string',
              format: 'did',
              description: 'DID of the follow target',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  AppBskyActorProfile: 'app.bsky.actor.profile',
  ComAtprotoRepoStrongRef: 'com.atproto.repo.strongRef',
  ComJjalcloudFeedDefs: 'com.jjalcloud.feed.defs',
  ComJjalcloudFeedGetSearch: 'com.jjalcloud.feed.getSearch',
  ComJjalcloudFeedGif: 'com.jjalcloud.feed.gif',
  ComJjalcloudFeedLike: 'com.jjalcloud.feed.like',
  ComJjalcloudGraphFollow: 'com.jjalcloud.graph.follow',
} as const
