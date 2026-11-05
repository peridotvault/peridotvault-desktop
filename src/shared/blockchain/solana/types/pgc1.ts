/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/pgc1.json`.
 */
export type Pgc1 = {
  "address": "DzDbFZXZsmFFv1mMFimLaBjAQi7Z5gUaQ61qcDuR6Kor",
  "metadata": {
    "name": "pgc1",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "canAccessGame",
      "discriminator": [
        101,
        154,
        70,
        158,
        61,
        66,
        181,
        109
      ],
      "accounts": [
        {
          "name": "game"
        },
        {
          "name": "user"
        },
        {
          "name": "licenseAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  99,
                  101,
                  110,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        }
      ],
      "args": [],
      "returns": "bool"
    },
    {
      "name": "createGame",
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "publisher",
          "writable": true,
          "signer": true
        },
        {
          "name": "gameAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "initialMinterAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "gameAccount"
              },
              {
                "kind": "arg",
                "path": "initialMinter"
              }
            ]
          }
        },
        {
          "name": "registryProgram"
        },
        {
          "name": "storeProgram"
        },
        {
          "name": "registryConfig"
        },
        {
          "name": "registryTreasury",
          "writable": true
        },
        {
          "name": "registryGame",
          "writable": true
        },
        {
          "name": "priceAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        },
        {
          "name": "initialMinter",
          "type": "pubkey"
        },
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
      "name": "hasLicense",
      "discriminator": [
        109,
        97,
        76,
        188,
        79,
        123,
        144,
        116
      ],
      "accounts": [
        {
          "name": "game"
        },
        {
          "name": "user"
        },
        {
          "name": "licenseAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  99,
                  101,
                  110,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        }
      ],
      "args": [],
      "returns": "bool"
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
          "name": "payer",
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
          "name": "authority",
          "type": "pubkey"
        },
        {
          "name": "authorizedStore",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "mintLicense",
      "discriminator": [
        57,
        204,
        93,
        84,
        160,
        241,
        254,
        52
      ],
      "accounts": [
        {
          "name": "minter",
          "signer": true
        },
        {
          "name": "minterAccount"
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
          "name": "game"
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "licenseAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  99,
                  101,
                  110,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
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
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "revokeLicense",
      "discriminator": [
        97,
        10,
        143,
        67,
        35,
        212,
        153,
        8
      ],
      "accounts": [
        {
          "name": "minter",
          "signer": true
        },
        {
          "name": "minterAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "game"
              },
              {
                "kind": "account",
                "path": "minter"
              }
            ]
          }
        },
        {
          "name": "game"
        },
        {
          "name": "user"
        },
        {
          "name": "licenseAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  99,
                  101,
                  110,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "setMinter",
      "discriminator": [
        13,
        170,
        92,
        172,
        137,
        194,
        39,
        2
      ],
      "accounts": [
        {
          "name": "publisher",
          "writable": true,
          "signer": true,
          "relations": [
            "gameAccount"
          ]
        },
        {
          "name": "gameAccount"
        },
        {
          "name": "minterAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "gameAccount"
              },
              {
                "kind": "arg",
                "path": "account"
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
          "name": "minter",
          "type": "pubkey"
        },
        {
          "name": "enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setPublisher",
      "discriminator": [
        110,
        54,
        4,
        216,
        151,
        85,
        46,
        91
      ],
      "accounts": [
        {
          "name": "gameAccount",
          "writable": true
        },
        {
          "name": "publisher",
          "signer": true,
          "relations": [
            "gameAccount"
          ]
        }
      ],
      "args": [
        {
          "name": "newPublisher",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateMetadataUri",
      "discriminator": [
        27,
        40,
        178,
        7,
        93,
        135,
        196,
        102
      ],
      "accounts": [
        {
          "name": "publisher",
          "writable": true,
          "signer": true,
          "relations": [
            "gameAccount"
          ]
        },
        {
          "name": "gameAccount",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newUri",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "licenseAccount",
      "discriminator": [
        120,
        20,
        28,
        217,
        130,
        168,
        223,
        118
      ]
    },
    {
      "name": "minterAccount",
      "discriminator": [
        96,
        76,
        128,
        125,
        228,
        218,
        240,
        23
      ]
    },
    {
      "name": "pgcConfig",
      "discriminator": [
        77,
        197,
        14,
        175,
        146,
        114,
        34,
        46
      ]
    },
    {
      "name": "pgcGameAccount",
      "discriminator": [
        34,
        116,
        14,
        33,
        43,
        198,
        84,
        223
      ]
    }
  ],
  "events": [
    {
      "name": "gameCreated",
      "discriminator": [
        218,
        25,
        150,
        94,
        177,
        112,
        96,
        2
      ]
    },
    {
      "name": "licenseIssued",
      "discriminator": [
        193,
        166,
        92,
        209,
        232,
        70,
        195,
        168
      ]
    },
    {
      "name": "licenseRevoked",
      "discriminator": [
        185,
        114,
        47,
        171,
        61,
        106,
        25,
        24
      ]
    },
    {
      "name": "metadataUpdated",
      "discriminator": [
        132,
        36,
        215,
        246,
        166,
        90,
        189,
        44
      ]
    },
    {
      "name": "minterUpdated",
      "discriminator": [
        8,
        124,
        66,
        45,
        176,
        53,
        49,
        153
      ]
    },
    {
      "name": "publisherUpdated",
      "discriminator": [
        169,
        238,
        92,
        110,
        140,
        167,
        198,
        170
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "gameAlreadyExists",
      "msg": "Game already exists"
    },
    {
      "code": 6001,
      "name": "licenseAlreadyExists",
      "msg": "License already exists"
    },
    {
      "code": 6002,
      "name": "licenseExpired",
      "msg": "License has expired"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6004,
      "name": "invalidGameId",
      "msg": "Invalid game ID"
    },
    {
      "code": 6005,
      "name": "invalidMetadataUri",
      "msg": "Invalid metadata URI"
    },
    {
      "code": 6006,
      "name": "registryCallFailed",
      "msg": "Registry call failed"
    },
    {
      "code": 6007,
      "name": "storeCallFailed",
      "msg": "Store call failed"
    },
    {
      "code": 6008,
      "name": "invalidMinter",
      "msg": "Invalid minter account"
    }
  ],
  "types": [
    {
      "name": "gameCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "string"
          },
          {
            "name": "publisher",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "licenseAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "issuedAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "licenseIssued",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "licenseRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "game",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "metadataUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "newUri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "minterAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "account",
            "type": "pubkey"
          },
          {
            "name": "isAuthorized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "minterUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "isAuthorized",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "pgcConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "authorizedStore",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pgcGameAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "string"
          },
          {
            "name": "publisher",
            "type": "pubkey"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "publisherUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "oldPublisher",
            "type": "pubkey"
          },
          {
            "name": "newPublisher",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
