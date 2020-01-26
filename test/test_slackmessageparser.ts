/*
Copyright 2020 Sorunome

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
	http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { expect } from "chai";
import { SlackMarkdownParser, SlackBlocksParser, SlackMessageParser } from "../src/slackmessageparser";

// we are a test file and thus our linting rules are slightly different
// tslint:disable:no-unused-expression max-file-line-count no-any no-magic-numbers no-string-literal

describe("SlackMarkdownParser", () => {
	const markdownParser = new SlackMarkdownParser();
	describe("parseMarkdown / simple", () => {
		it("should parse simple markdown content", async () => {
			const ret = await markdownParser.parseMarkdown({} as any, { slackOnly: false }, "This *is* a _super_ test");
			expect(ret).to.equal("This <strong>is</strong> a <em>super</em> test");
		});
		it("should html escape stuff", async () => {
			const ret = await markdownParser.parseMarkdown({} as any, { slackOnly: false }, "<b>test</b>");
			expect(ret).to.equal("&lt;b&gt;test&lt;/b&gt;");
		});
		it("should not parse markdown, if set", async () => {
			const ret = await markdownParser.parseMarkdown({} as any, { slackOnly: true }, "This *is* a _super_ test");
			expect(ret).to.equal("This *is* a _super_ test");
		});
		it("should not escape html, if set", async () => {
			const ret = await markdownParser.parseMarkdown({} as any, { slackOnly: true }, "<b>test</b>");
			expect(ret).to.equal("<b>test</b>");
		});
	});
	describe("parseMarkdown / userpills", () => {
		it("should insert user pills", async () => {
			const opts = { callbacks: {
				getUser: async (id, name) => {
					return {
						mxid: `@_slack_${id}:example.org`,
						name: "Ghost" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <@blah>!");
			expect(ret).to.equal("Hey <a href=\"https://matrix.to/#/@_slack_blah:example.org\">Ghostblah</a>!");
		});
		it("should insert name-only if html disabled", async () => {
			const opts = { callbacks: {
				getUser: async (id, name) => {
					return {
						mxid: `@_slack_${id}:example.org`,
						name: "Ghost" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: true }, "Hey <@blah>!");
			expect(ret).to.equal("Hey Ghostblah!");
		});
		it("should handle multiple pills", async () => {
			const opts = { callbacks: {
				getUser: async (id, name) => {
					return {
						mxid: `@_slack_${id}:example.org`,
						name: "Ghost" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <@blah> <@blubb>!");
			expect(ret).to.equal("Hey <a href=\"https://matrix.to/#/@_slack_blah:example.org\">Ghostblah</a>" +
				" <a href=\"https://matrix.to/#/@_slack_blubb:example.org\">Ghostblubb</a>!");
		});
		it("should fall back to the provided name, should it exist", async () => {
			const opts = { callbacks: {
				getUser: async (id, name) => null,
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <@blah|Blah>!");
			expect(ret).to.equal("Hey Blah!");
		});
		it("should fall back to the userpill, should everything fail", async () => {
			const opts = { callbacks: {
				getUser: async (id, name) => null,
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <@blah>!");
			expect(ret).to.equal("Hey &lt;@blah&gt;!");
		});
	});
	describe("parseMarkdown / channelpills", () => {
		it("should insert channel pills", async () => {
			const opts = { callbacks: {
				getChannel: async (id, name) => {
					return {
						mxid: `#_slack_${id}:example.org`,
						name: "Chan" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <#blah>!");
			expect(ret).to.equal("Hey <a href=\"https://matrix.to/#/#_slack_blah:example.org\">Chanblah</a>!");
		});
		it("should insert name-only if html disabled", async () => {
			const opts = { callbacks: {
				getChannel: async (id, name) => {
					return {
						mxid: `#_slack_${id}:example.org`,
						name: "Chan" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: true }, "Hey <#blah>!");
			expect(ret).to.equal("Hey #Chanblah!");
		});
		it("should handle multiple pills", async () => {
			const opts = { callbacks: {
				getChannel: async (id, name) => {
					return {
						mxid: `#_slack_${id}:example.org`,
						name: "Chan" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <#blah> <#blubb>!");
			expect(ret).to.equal("Hey <a href=\"https://matrix.to/#/#_slack_blah:example.org\">Chanblah</a>" +
				" <a href=\"https://matrix.to/#/#_slack_blubb:example.org\">Chanblubb</a>!");
		});
		it("should fall back to the provided name, should it exist", async () => {
			const opts = { callbacks: {
				getChannel: async (id, name) => null,
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <#blah|Blah>!");
			expect(ret).to.equal("Hey #Blah!");
		});
		it("should fall back to the channel pill, should everything fail", async () => {
			const opts = { callbacks: {
				getChannel: async (id, name) => null,
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <#blah>!");
			expect(ret).to.equal("Hey &lt;#blah&gt;!");
		});
	});
	describe("parseMarkdown / usergrouppills", () => {
		it("should insert usergroup pills", async () => {
			const opts = { callbacks: {
				getUsergroup: async (id, name) => {
					return {
						mxid: `+_slack_${id}:example.org`,
						name: "Group" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <!subteam^blah>!");
			expect(ret).to.equal("Hey <a href=\"https://matrix.to/#/+_slack_blah:example.org\">Groupblah</a>!");
		});
		it("should set name only, if the mxid is blank", async () => {
			const opts = { callbacks: {
				getUsergroup: async (id, name) => {
					return {
						mxid: "",
						name: "Group" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <!subteam^blah>!");
			expect(ret).to.equal("Hey Groupblah!");
		});
		it("should insert name-only if html disabled", async () => {
			const opts = { callbacks: {
				getUsergroup: async (id, name) => {
					return {
						mxid: `+_slack_${id}:example.org`,
						name: "Group" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: true }, "Hey <!subteam^blah>!");
			expect(ret).to.equal("Hey Groupblah!");
		});
		it("should handle multiple pills", async () => {
			const opts = { callbacks: {
				getUsergroup: async (id, name) => {
					return {
						mxid: `+_slack_${id}:example.org`,
						name: "Group" + id,
					};
				},
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <!subteam^blah> <!subteam^blubb>!");
			expect(ret).to.equal("Hey <a href=\"https://matrix.to/#/+_slack_blah:example.org\">Groupblah</a>" +
				" <a href=\"https://matrix.to/#/+_slack_blubb:example.org\">Groupblubb</a>!");
		});
		it("should fall back to the provided name, should it exist", async () => {
			const opts = { callbacks: {
				getUsergroup: async (id, name) => null,
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <!subteam^blah|Blah>!");
			expect(ret).to.equal("Hey Blah!");
		});
		it("should fall back to the usergrouppill, should everything fail", async () => {
			const opts = { callbacks: {
				getUsergroup: async (id, name) => null,
			}} as any;
			const ret = await markdownParser.parseMarkdown(opts, { slackOnly: false }, "Hey <!subteam^blah>!");
			expect(ret).to.equal("Hey &lt;!subteam^blah&gt;!");
		});
	});
});

describe("SlackBlocksParser", () => {
	const markdownParser = new SlackMarkdownParser();
	describe("parseBlocks", () => {
		it("should parse each block and sum up the result", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			blocksParser["parseBlock"] = (async (opts, block) => block) as any;
			const blocks = ["foo", "bar"] as any[];
			const ret = await blocksParser.parseBlocks({} as any, blocks);
			expect(ret).to.equal("foobar");
		});
	});
	describe("parseElement", () => {
		it("should parse image elements", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const element = {
				type: "image",
				image_url: "https://example.org/fox.png",
				alt_text: "Fox",
			} as any;
			const opts = { callbacks: {
				urlToMxc: async (url) => url,
			}} as any;
			const ret = await blocksParser["parseElement"](opts, element);
			expect(ret).to.equal("<img alt=\"Fox\" title=\"Fox\" height=\"32\" src=\"https://example.org/fox.png\" />");
		});
		it("should parse image elements, if upload fails", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const element = {
				type: "image",
				image_url: "https://example.org/fox.png",
				alt_text: "Fox",
			} as any;
			const opts = { callbacks: {
				urlToMxc: async (url) => null,
			}} as any;
			const ret = await blocksParser["parseElement"](opts, element);
			expect(ret).to.equal("<a href=\"https://example.org/fox.png\">Fox</a>");
		});
		it("should parse mrkdwn elements", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const element = {
				type: "mrkdwn",
				text: "some *markdown* _text_",
			} as any;
			const ret = await blocksParser["parseElement"]({} as any, element);
			expect(ret).to.equal("some <strong>markdown</strong> <em>text</em>");
		});
		it("should parse plain_text elements", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const element = {
				type: "plain_text",
				text: "some *plain* <b>text</b>",
			} as any;
			const ret = await blocksParser["parseElement"]({} as any, element);
			expect(ret).to.equal("some *plain* &lt;b&gt;text&lt;/b&gt;");
		});
	});
	describe("parseBlock", () => {
		it("should parse rich_text blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "rich_text",
				elements: [{
					type: "text",
					text: "blah",
				}],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("blah");
		});
		it("should parse rich_text_section blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "rich_text_section",
				elements: [{
					type: "text",
					text: "blah",
				}],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<p>blah</p>");
		});
		it("should not wrap rich_text_section blocks in <p> if already inBlock", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "rich_text_section",
				elements: [{
					type: "text",
					text: "blah",
				}],
			} as any;
			const ret = await blocksParser["parseBlock"]({ inBlock: true } as any, block);
			expect(ret).to.equal("blah");
		});
		it("should parse rich_text_preformatted blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "rich_text_preformatted",
				elements: [{
					type: "text",
					text: "blah",
				}],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<pre><code>blah</code></pre>");
		});
		it("should parse rich_text_quote blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "rich_text_quote",
				elements: [{
					type: "text",
					text: "blah",
				}],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<blockquote>blah</blockquote>");
		});
		it("should parse rich_text_list ordered lists", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "rich_text_list",
				style: "ordered",
				index: 0,
				elements: [{
					type: "text",
					text: "blah",
				}],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<ol start=\"1\"><li>blah</li></ol>");
		});
		it("should parse rich_text_list bullet lists", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "rich_text_list",
				style: "bullet",
				elements: [{
					type: "text",
					text: "blah",
				}],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<ul><li>blah</li></ul>");
		});
		it("should parse simple text blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "text",
				text: "blah",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("blah");
		});
		it("should parse formatted text blocks", async () => {
			for (const [prop, tag] of [["bold", "strong"], ["italic", "em"], ["strike", "del"], ["code", "code"]]) {
				const blocksParser = new SlackBlocksParser(markdownParser);
				const block = {
					type: "text",
					text: "blah",
					style: {},
				} as any;
				block.style[prop] = true;
				const ret = await blocksParser["parseBlock"]({} as any, block);
				expect(ret).to.equal(`<${tag}>blah</${tag}>`);
			}
		});
		it("should parse formatted text blocks with multiple styles", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "text",
				text: "blah",
				style: {
					italic: true,
					strike: true,
				},
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal(`<em><del>blah</del></em>`);
		});
		it("should html-escape content of text blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "text",
				text: "<b>blah</b>",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("&lt;b&gt;blah&lt;/b&gt;");
		});
		it("should parse emoji blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "emoji",
				name: "fox_face",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("🦊");
		});
		it("should put emoji codes for non-existing emojis", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "emoji",
				name: "asdf",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal(":asdf:");
		});
		it("should parse link blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "link",
				url: "https://example.org",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<a href=\"https://example.org\">https://example.org</a>");
		});
		it("should parse user blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "user",
				user_id: "blah",
			} as any;
			const opts = { callbacks: {
				getUser: async (id, name) => {
					return {
						mxid: `@_slack_${id}:example.org`,
						name: "User" + id,
					};
				},
			}} as any;
			const ret = await blocksParser["parseBlock"](opts, block);
			expect(ret).to.equal("<a href=\"https://matrix.to/#/@_slack_blah:example.org\">Userblah</a>");
		});
		it("should fall user blocks back if user not found", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "user",
				user_id: "blah",
			} as any;
			const opts = { callbacks: {
				getUser: async (id, name) => null,
			}} as any;
			const ret = await blocksParser["parseBlock"](opts, block);
			expect(ret).to.equal("&lt;@blah&gt;");
		});
		it("should parse channel blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "channel",
				channel_id: "blah",
			} as any;
			const opts = { callbacks: {
				getChannel: async (id, name) => {
					return {
						mxid: `#_slack_${id}:example.org`,
						name: "Chan" + id,
					};
				},
			}} as any;
			const ret = await blocksParser["parseBlock"](opts, block);
			expect(ret).to.equal("<a href=\"https://matrix.to/#/#_slack_blah:example.org\">Chanblah</a>");
		});
		it("should fall channel blocks back if user not found", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "channel",
				channel_id: "blah",
			} as any;
			const opts = { callbacks: {
				getChannel: async (id, name) => null,
			}} as any;
			const ret = await blocksParser["parseBlock"](opts, block);
			expect(ret).to.equal("&lt;#blah&gt;");
		});
		it("should parse broadcast blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "broadcast",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("@room");
		});
		it("should parse divider blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "divider",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<hr>");
		});
		it("should parse simple section blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "section",
				text: {
					type: "plain_text",
					text: "blah",
				},
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<p>blah</p>");
		});
		it("should parse section blocks with fields", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "section",
				fields: [
					{
						type: "plain_text",
						text: "1",
					},
					{
						type: "plain_text",
						text: "2",
					},
					{
						type: "plain_text",
						text: "3",
					},
					{
						type: "plain_text",
						text: "4",
					},
				],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<table><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>");
		});
		it("should parse simple image blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "image",
				image_url: "https://example.org/fox.png",
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<p>Image: <a href=\"https://example.org/fox.png\">https://example.org/fox.png</a></p>");
		});
		it("should parse image blocks with titles", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "image",
				image_url: "https://example.org/fox.png",
				title: {
					type: "plain_text",
					text: "Fox!",
				},
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<p>Fox!<br>Image: " +
				"<a href=\"https://example.org/fox.png\">https://example.org/fox.png</a></p>");
		});
		it("should parse context blocks", async () => {
			const blocksParser = new SlackBlocksParser(markdownParser);
			const block = {
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: "*Awesome*",
					},
					{
						type: "plain_text",
						text: "Fox",
					},
				],
			} as any;
			const ret = await blocksParser["parseBlock"]({} as any, block);
			expect(ret).to.equal("<p><strong>Awesome</strong> Fox </p>");
		});
	});
});

describe("SlackMessageParser", () => {
	const messageParser = new SlackMessageParser();
	describe("simple", () => {
		it("should parse simple messages", async () => {
			const event = {
				text: "*yay* this is _awesome_",
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("*yay* this is _awesome_");
			expect(ret.formattedBody).to.equal("<strong>yay</strong> this is <em>awesome</em>");
		});
		it("should parse user pills", async () => {
			const event = {
				text: "Hey <@blah>!",
			} as any;
			const opts = { callbacks: {
				getUser: async (id, name) => {
					return {
						mxid: `@_slack_${id}:example.org`,
						name: "User" + id,
					};
				},
			}} as any;
			const ret = await messageParser.FormatMessage(opts, event);
			expect(ret.body).to.equal("Hey Userblah!");
			expect(ret.formattedBody).to.equal("Hey <a href=\"https://matrix.to/#/@_slack_blah:example.org\">Userblah</a>!");
		});
		it("should parse text", async () => {
			const ret = await messageParser.FormatText({} as any, "*yay* this is _awesome_");
			expect(ret.body).to.equal("*yay* this is _awesome_");
			expect(ret.formattedBody).to.equal("<strong>yay</strong> this is <em>awesome</em>");
		});
	});
	describe("attachments", () => {
		it("should handle blank attachments", async () => {
			const event = {
				text: "",
				attachments: [{ }],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p></p>");
		});
		it("should handle attachments with pretext", async () => {
			const event = {
				text: "",
				attachments: [{
					pretext: "*yay*",
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\n*yay*\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p><strong>yay</strong><br></p>");
		});
		it("should handle attachments with an author", async () => {
			const event = {
				text: "",
				attachments: [{
					author_name: "Fox",
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\nFox\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p>Fox<br></p>");
		});
		it("should handle attachments with author icon and link", async () => {
			const event = {
				text: "",
				attachments: [{
					author_name: "Fox",
					author_icon: "https://example.org/fox.png",
					author_link: "https://example.org",
				}],
			} as any;
			const opts = { callbacks: {
				urlToMxc: async (url) => url,
			}} as any;
			const ret = await messageParser.FormatMessage(opts, event);
			expect(ret.body).to.equal("\n\n---------------------\n[Fox](https://example.org)\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p><img height=\"32\" src=\"https://example.org/fox.png\" /> " +
				"<a href=\"https://example.org\">Fox</a><br></p>");
		});
		it("should handle attachments with a title", async () => {
			const event = {
				text: "",
				attachments: [{
					title: "Foxies!",
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\n## Foxies!\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p><h2>Foxies!</h2></p>");
		});
		it("should handle attachments with a title link", async () => {
			const event = {
				text: "",
				attachments: [{
					title: "Foxies!",
					title_link: "https://example.org"
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\n## [Foxies!](https://example.org)\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p><h2><a href=\"https://example.org\">Foxies!</a></h2></p>");
		});
		it("should handle attachments with text", async () => {
			const event = {
				text: "",
				attachments: [{
					text: "Foxies are _awesome_!",
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\nFoxies are _awesome_!\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p>Foxies are <em>awesome</em>!<br></p>");
		});
		it("should handle attachment fields", async () => {
			const event = {
				text: "",
				attachments: [{
					fields: [
						{
							title: "a",
							value: "1",
						},
						{
							title: "b",
							value: "2",
						},
						{
							title: "c",
							value: "3",
						},
						{
							title: "d",
							value: "4",
						},
					],
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\n*a*\n1\n*b*\n2\n*c*\n3\n*d*\n4\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p><table><tr><td><strong>a</strong><br>1</td>" +
				"<td><strong>b</strong><br>2</td></tr><tr><td><strong>c</strong><br>3</td>" +
				"<td><strong>d</strong><br>4</td></tr></table></p>");
		});
		it("should handle attachment image_url's", async () => {
			const event = {
				text: "",
				attachments: [{
					image_url: "https://example.org/fox.png",
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\nImage: https://example.org/fox.png\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p>Image: " +
				"<a href=\"https://example.org/fox.png\">https://example.org/fox.png</a><br></p>");
		});
		it("should handle attachments with footer", async () => {
			const event = {
				text: "",
				attachments: [{
					footer: "byebye",
				}],
			} as any;
			const ret = await messageParser.FormatMessage({} as any, event);
			expect(ret.body).to.equal("\n\n---------------------\nbyebye\n");
			expect(ret.formattedBody).to.equal("<br><br><hr><p>byebye<br></p>");
		});
	});
});
