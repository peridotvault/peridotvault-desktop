/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/game_store.json`.
 */
export type GameStore = {
  "address": "6gTd8TQ9NiC7yxBfGWBzH1aWdk77fg779nUJhYTrEsPd",
  "metadata": {
    "name": "gameStore",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "buyGame",
      "discriminator": [
        230,
        118,
        208,
        28,
        185,
        30,
        230,
        155
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "game"
        },
        {
          "name": "priceAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "publisher"
        },
        {
          "name": "publisherBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "publisher"
              },
              {
                "kind": "account",
                "path": "price_account.currency",
                "account": "priceAccount"
              }
            ]
          }
        },
        {
          "name": "pgcProgram"
        },
        {
          "name": "pgcConfig"
        },
        {
          "name": "licensePda",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "buyerTokenAccount",
          "writable": true
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true
        },
        {
          "name": "publisherTokenAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "platformFeeBps",
          "type": "u16"
        },
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setAffiliate",
      "discriminator": [
        239,
        206,
        13,
        0,
        98,
        227,
        86,
        233
      ],
      "accounts": [
        {
          "name": "governance",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "affiliate",
          "type": "pubkey"
        },
        {
          "name": "bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setPlatformFee",
      "discriminator": [
        19,
        70,
        111,
        182,
        156,
        58,
        208,
        203
      ],
      "accounts": [
        {
          "name": "governance",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setPrice",
      "discriminator": [
        16,
        19,
        182,
        8,
        149,
        83,
        72,
        181
      ],
      "accounts": [
        {
          "name": "publisher",
          "writable": true,
          "signer": true
        },
        {
          "name": "game"
        },
        {
          "name": "priceAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "currency",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setSubscription",
      "discriminator": [
        63,
        240,
        195,
        242,
        14,
        124,
        40,
        179
      ],
      "accounts": [
        {
          "name": "governance",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "duration",
          "type": "i64"
        },
        {
          "name": "price",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setTreasury",
      "discriminator": [
        57,
        97,
        196,
        95,
        195,
        206,
        106,
        136
      ],
      "accounts": [
        {
          "name": "governance",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "publisher",
          "writable": true,
          "signer": true,
          "relations": [
            "balanceAccount"
          ]
        },
        {
          "name": "balanceAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "publisher"
              },
              {
                "kind": "account",
                "path": "balance_account.token",
                "account": "publisherBalanceAccount"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "publisherTokenAccount",
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "priceAccount",
      "discriminator": [
        85,
        228,
        226,
        113,
        218,
        91,
        116,
        92
      ]
    },
    {
      "name": "publisherBalanceAccount",
      "discriminator": [
        43,
        21,
        136,
        160,
        91,
        142,
        226,
        72
      ]
    },
    {
      "name": "storeConfig",
      "discriminator": [
        108,
        23,
        66,
        65,
        67,
        124,
        167,
        135
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "invalidCurrency",
      "msg": "Invalid currency"
    },
    {
      "code": 6002,
      "name": "invalidDiscountBps",
      "msg": "Invalid discount BPS"
    },
    {
      "code": 6003,
      "name": "invalidPlatformFeeBps",
      "msg": "Invalid platform fee BPS"
    },
    {
      "code": 6004,
      "name": "emptyPublisherBalance",
      "msg": "Empty publisher balance"
    },
    {
      "code": 6005,
      "name": "invalidGovernance",
      "msg": "Invalid governance address"
    },
    {
      "code": 6006,
      "name": "invalidTreasury",
      "msg": "Invalid treasury address"
    },
    {
      "code": 6007,
      "name": "invalidTokenProgram",
      "msg": "Invalid token program"
    },
    {
      "code": 6008,
      "name": "invalidTokenMint",
      "msg": "Invalid token mint"
    }
  ],
  "types": [
    {
      "name": "priceAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "currency",
            "type": "pubkey"
          },
          {
            "name": "discountBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "publisherBalanceAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "publisher",
            "type": "pubkey"
          },
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "storeConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "governance",
            "type": "pubkey"
          },
          {
            "name": "platformFeeBps",
            "type": "u16"
          }
        ]
      }
    }
  ]
};
