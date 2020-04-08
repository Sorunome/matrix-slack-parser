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
import { MatrixMessageParser } from "../src/matrixmessageparser";

// we are a test file and thus our linting rules are slightly different
// tslint:disable:no-unused-expression max-file-line-count no-any no-magic-numbers no-string-literal

describe("MatrixMessageParser", () => {
	const parser = new MatrixMessageParser();
	describe("simple", () => {
		it("should handle plain messages", async () => {
			const event = {
				body: "Hello World!",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("Hello World!");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [{
						type: "text",
						text: "Hello World!",
					}],
				}],
			}]);
		});
		it("should escape slack markdown in plain messages", async () => {
			const event = {
				body: "*hello* _world_ `how` ~are~ you?",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("\ufff1*\ufff1hello\ufff1*\ufff1 \ufff1_\ufff1world\ufff1_\ufff1 " +
				"\ufff1`\ufff1how\ufff1`\ufff1 \ufff1~\ufff1are\ufff1~\ufff1 you?");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [{
						type: "text",
						text: "*hello* _world_ `how` ~are~ you?",
					}],
				}],
			}]);
		});
		it("should handle simple html codes", async () => {
			const event = {
				formatted_body: "<b>hello</b> <i>world</i> <code>how</code> <del>are</del> you?",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("*hello* _world_ `how` ~are~ you?");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "hello", style: { bold: true }},
						{ type: "text", text: " " },
						{ type: "text", text: "world", style: { italic: true }},
						{ type: "text", text: " " },
						{ type: "text", text: "how", style: { code: true }},
						{ type: "text", text: " " },
						{ type: "text", text: "are", style: { strike: true }},
						{ type: "text", text: " you?" },
					],
				}],
			}]);
		});
		it("should handle nested html codes", async () => {
			const event = {
				formatted_body: "Foxies are <strong><em>awesome</em></strong>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("Foxies are *_awesome_*");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "Foxies are " },
						{ type: "text", text: "awesome", style: { bold: true, italic: true }},
					],
				}],
			}]);
		});
		it("should handle unhandled html tags", async () => {
			const event = {
				formatted_body: "Where did the <u>fox</u> go?",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("Where did the fox go?");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "Where did the fox go?" },
					],
				}],
			}]);
		});
		it("should linkify links", async () => {
			const event = {
				body: "Hey, did you hear of https://example.org",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("Hey, did you hear of https://example.org");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{
							type: "text",
							text: "Hey, did you hear of ",
						},
						{
							type: "link",
							url: "https://example.org",
						},
					],
				}],
			}]);
		});
		it("should handle links-only messages", async () => {
			const event = {
				body: "https://example.org",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("https://example.org");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{
							type: "link",
							url: "https://example.org",
						},
					],
				}],
			}]);
		});
	});
	describe("blocks", () => {
		it("should handle code blocks", async () => {
			const event = {
				formatted_body: "<pre><code>foxies</code></pre>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("```foxies```");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_preformatted",
					elements: [
						{ type: "text", text: "foxies" },
					],
				}],
			}]);
		});
		it("should handle code blocks without code tag", async () => {
			const event = {
				formatted_body: "<pre>foxies</pre>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("```foxies```");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_preformatted",
					elements: [
						{ type: "text", text: "foxies" },
					],
				}],
			}]);
		});
		it("should handle blockquotes", async () => {
			const event = {
				formatted_body: "<blockquote>foxies</blockquote>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("> foxies");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_quote",
					elements: [
						{ type: "text", text: "foxies" },
					],
				}],
			}]);
		});
		it("should handle ul", async () => {
			const event = {
				formatted_body: "<ul><li>fox</li><li>bunny</li></ul>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("\n● fox\n● bunny");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_list",
					elements: [
						{ type: "rich_text_section", elements: [{ type: "text", text: "fox" }]},
						{ type: "rich_text_section", elements: [{ type: "text", text: "bunny" }]},
					],
					style: "bullet",
					indent: 0,
				}],
			}]);
		});
		it("should handle ol", async () => {
			const event = {
				formatted_body: "<ol><li>fox</li><li>bunny</li></ol>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("\n1. fox\n2. bunny");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_list",
					elements: [
						{ type: "rich_text_section", elements: [{ type: "text", text: "fox" }]},
						{ type: "rich_text_section", elements: [{ type: "text", text: "bunny" }]},
					],
					style: "ordered",
					indent: 0,
				}],
			}]);
		});
		it("should handle nested lists", async () => {
			const event = {
				formatted_body: "<ul><li>fox</li><li><ul><li>tail</li><li>snout</li></ul></li><li>bunny</li></ul>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("\n● fox\n●     ○ tail\n    ○ snout\n● bunny");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_list",
					elements: [
						{ type: "rich_text_section", elements: [{ type: "text", text: "fox" }]},
						{ type: "rich_text_section", elements: [{ type: "text", text: "    ○ tail\n    ○ snout\n" }]},
						{ type: "rich_text_section", elements: [{ type: "text", text: "bunny" }]},
					],
					style: "bullet",
					indent: 0,
				}],
			}]);
		});
		it("should handle a mix of different blocks", async () => {
			const event = {
				formatted_body: "text\n<pre><code>code</code></pre>more text\n<blockquote>quote</blockquote>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("text\n```code```\nmore text\n> quote");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [
					{
						type: "rich_text_section",
						elements: [{ type: "text", text: "text\n" }],
					},
					{
						type: "rich_text_preformatted",
						elements: [{ type: "text", text: "code" }],
					},
					{
						type: "rich_text_section",
						elements: [{ type: "text", text: "more text\n" }],
					},
					{
						type: "rich_text_quote",
						elements: [{ type: "text", text: "quote" }],
					},
				],
			}]);
		});
	});
	describe("misc html", () => {
		it("should handle links", async () => {
			const event = {
				formatted_body: "<a href=\"https://example.org\">link</a>",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("<https://example.org|link>");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [{ type: "link", url: "https://example.org", text: "link" }],
				}],
			}]);
		});
		it("should handle images", async () => {
			const event = {
				formatted_body: "<img src=\"https://example.org/fox.png\" alt=\"fox\" />",
			} as any;
			const opts = { callbacks: {
				mxcUrlToHttp: (s) => s,
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("<https://example.org/fox.png|fox>");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [{ type: "link", url: "https://example.org/fox.png", text: "fox" }],
				}],
			}]);
		});
		it("should handle images without alt text", async () => {
			const event = {
				formatted_body: "<img src=\"https://example.org/fox.png\" />",
			} as any;
			const opts = { callbacks: {
				mxcUrlToHttp: (s) => s,
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("<https://example.org/fox.png>");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [{ type: "link", url: "https://example.org/fox.png" }],
				}],
			}]);
		});
		it("should handle br correctly", async () => {
			const event = {
				formatted_body: "fox<br>break",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("fox\nbreak");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [{ type: "text", text: "fox\nbreak" }],
				}],
			}]);
		});
		it("should handle hr correctly", async () => {
			const event = {
				formatted_body: "fox<hr>break",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal("fox\n----------\nbreak");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [{ type: "text", text: "fox\n----------\nbreak" }],
				}],
			}]);
		});
		it("should handle headings correctly", async () => {
			for (let i = 1; i <= 6; i++) {
				const event = {
					formatted_body: `<h${i}>fox</h${i}>`,
				} as any;
				const ret = await parser.FormatMessage({} as any, event);
				expect(ret.text).to.equal(`*${"#".repeat(i)} fox*`);
				expect(ret.blocks).eql([{
					type: "rich_text",
					elements: [{
						type: "rich_text_section",
						elements: [
							{ type: "text", text: "#".repeat(i) + " fox", style: { bold: true }},
							{ type: "text", text: "\n" },
						],
					}],
				}]);
			}
		});
		it("should handle spoiler tags", async () => {
			const event = {
				formatted_body: `<span data-mx-spoiler>fox</span>`,
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal(`(Spoiler: fox)`);
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "(Spoiler: fox)" },
					],
				}],
			}]);
		});
		it("should handle spoiler tags with reason", async () => {
			const event = {
				formatted_body: `<span data-mx-spoiler="floof">fox</span>`,
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal(`(Spoiler for floof: fox)`);
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "(Spoiler for floof: fox)" },
					],
				}],
			}]);
		});
	});
	describe("matrix", () => {
		it("should strip mx-reply tags", async () => {
			const event = {
				formatted_body: "<mx-reply>Original content</mx-reply>fox?",
			} as any;
			const ret = await parser.FormatMessage({} as any, event);
			expect(ret.text).to.equal(`fox?`);
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "fox?" },
					],
				}],
			}]);
		});
		it("should handle userpills", async () => {
			const event = {
				formatted_body: "<a href=\"https://matrix.to/#/@_slack_blah:example.org\">Blah</a>",
			} as any;
			const opts = { callbacks: {
				getUserId: async (mxid) => "blah",
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("<@blah>");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "user", user_id: "blah" },
					],
				}],
			}]);
		});
		it("should handle custom userpills", async () => {
			const event = {
				formatted_body: "<a href=\"https://matrix.to/#/@fox:example.org\">Fox</a>",
			} as any;
			const opts = { callbacks: {
				getUserId: async (mxid) => null,
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("<https://matrix.to/#/@fox:example.org|Fox>");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "link", url: "https://matrix.to/#/@fox:example.org", text: "Fox" },
					],
				}],
			}]);
		});
		it("should handle channel pills", async () => {
			const event = {
				formatted_body: "<a href=\"https://matrix.to/#/#_slack_blah:example.org\">Blah</a>",
			} as any;
			const opts = { callbacks: {
				getChannelId: async (mxid) => "blah",
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("<#blah>");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "channel", channel_id: "blah" },
					],
				}],
			}]);
		});
		it("should handle custom channel pills", async () => {
			const event = {
				formatted_body: "<a href=\"https://matrix.to/#/#fox:example.org\">Fox</a>",
			} as any;
			const opts = { callbacks: {
				getChannelId: async (mxid) => null,
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("<https://matrix.to/#/#fox:example.org|Fox>");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "link", url: "https://matrix.to/#/#fox:example.org", text: "Fox" },
					],
				}],
			}]);
		});
		it("should ignore @room if there are no permissions", async () => {
			const event = {
				formatted_body: "Hey @room!",
			} as any;
			const opts = { callbacks: {
				canNotifyRoom: async () => false,
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("Hey @room!");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "Hey @room!" },
					],
				}],
			}]);
		});
		it("should parse @room, if permitted", async () => {
			const event = {
				formatted_body: "Hey @room!",
			} as any;
			const opts = { callbacks: {
				canNotifyRoom: async () => true,
			}} as any;
			const ret = await parser.FormatMessage(opts, event);
			expect(ret.text).to.equal("Hey <!channel>!");
			expect(ret.blocks).eql([{
				type: "rich_text",
				elements: [{
					type: "rich_text_section",
					elements: [
						{ type: "text", text: "Hey " },
						{ type: "broadcast", range: "channel" },
						{ type: "text", text: "!" },
					],
				}],
			}]);
		});
	});
});
