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
import { SlackMarkdownParser } from "../src/slackmessageparser";

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
