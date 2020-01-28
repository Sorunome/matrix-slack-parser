# matrix-slack-parser
This package is a message parser for sending messages between [Matrix](https://matrix.org/) and [Slack](https://slack.com/). For that, it has two parsers: `SlackMessageParser` and `MatrixMessageParser`.

## Installation
`npm install --save matrix-slack-parser`

## SlackMessageParser
Example code:
```ts
import { SlackMessageParser, ISlackMessageParserOpts } from "matrix-slack-parser";

const parser = new SlackMessageParser();
const opts = {
    callbacks: {
        getUser: async (id: string, name: string) => null,
        getChannel: async (id: string, name: string) => null,
        getUsergroup: async (id: string, name: string) => null,
        getTeam: async (id: string, name: string) => null,
        urlToMxc: async (url: string) => null,
    },
} as ISlackMessageParserOpts;
const message = msg; // a slack message object. The one with the keys "text" and optionally "blocks", "attachments"
const result = await parser.FormatMessage(opts, message);
console.log(results); // this is a matrix message content, ready to be sent
```

All options of `ISlackMessageParserOpts`:
 * `callbacks`: `ISlackMessageParserCallbacks`, the callbacks to handle
    * `getUser`: `async (id: string, name: string) => Promise<ISlackMessageParserEntity | null>`, resolves to
      either the information on the slack user or to null. `name` cannot be trusted.
    * `getChannel`: `async (id: string, name: string) => Promise<ISlackMessageParserEntity | null>`, resolves to
      either the information on the slack channel or to null. `name` cannot be trusted.
    * `getUsergroup`: `async (id: string, name: string) => Promise<ISlackMessageParserEntity | null>`, resolves to
      either the information on the slack usergroup or to null. `name` cannot be trusted.
    * `getTeam`: `async (id: string, name: string) => Promise<ISlackMessageParserEntity | null>`, resolves to
      either the information on the slack team or to null. `name` cannot be trusted.
    * `urlToMxc`: `async (url: string) => Promise<string | null>`, resolves to
      an mxc url associated with the http url, or null. If you don't de-dupe images it is recommended to resolve to null.

All properties of `ISlackMessageParserEntity`:
 * `name`: `string`, the name of the entity
 * `mxid`: `string`, the resulting matrix ID of the entity

## MatrixMessageParser
Example code:
```ts
import { MatrixMessageParser, IMatrixMessageParserOpts } from "matrix-slack-parser":

const parser = new MatrixMessageParser)();
const opts = {
    callbacks: {
        canNotifyRoom: async () => false,
        getUserId: async (mxid: string) => null,
        getChannelId: async (mxid: string) => null,
        mxcUrlToHttp: async (mxc: string) => "http://example.com",
    },
} as IMatrixMessageParserOpts;

const msg = { // raw matrix event content
    msgtype: "m.text",
    body: "**blah**",
    format: "org.matrix.custom.html",
    formatted_body: "<strong>blah</strong>",
};

const result = await parser.FormatMessage(opts, msg);
console.log(result); // a slack message ready to send, with the properties "text" and "blocks"
```

It is expected to create the options for a message within a closure so that the callbacks can
determine if, for that particular message, the author may e.g. notify that particular room.

All options of `IMatrixMessageParserOpts`:
 * `callbacks`: `IMatrixMessageParserCallbacks`, the callbacks to handle
    * `canNotifyRoom`: `async () => Promise<boolean>`, return if that particular user can notify
      that particular room
    * `getUserId`: `async (mxid: string) => Promise<string | null>`, return the slack user ID
      given an mxid, or null
    * `getChannelId`: `async (mxid: string) => Promise<string | null>`, return the slack channel
      ID given an mxid, or null
    * `mxcUrlToHttp`: `async (mxc: string) => Promise<string>`, resolve an mxc uri to a publicly
      available http url.

Returned is a slack message object. If you only want to send the markdown-formatted message, use `result.text`.
If you want to also send the blocks, send both `result.text` and `result.blocks`, so something like:

```ts
await web.chat.postMessage({
    ...result,
    channel,
    as_user: true,
});
```
