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

import {
	ISlackMessage, AllBlocks, ISlackBlockRichText, ISlackRichTextSection, ISlackBlockText, ISlackBlockEmoji,
	ISlackRichTextPre, ISlackRichTextQuote, ISlackRichTextList, ISlackBlockUser, ISlackBlockChannel, ISlackBlockBroadcast,
	ISlackBlockLink, ISlackBlockUsergroup, ISlackBlockTeam, ISlackBlockDate, ISlackBlockColor,
} from "./slacktypes";
import * as escapeHtml from "escape-html";
import * as unescapeHtml from "unescape-html";
import * as emoji from "node-emoji";
import { SectionBlock, PlainTextElement, MrkdwnElement, ImageBlock, ContextBlock, ImageElement } from "@slack/types";
import * as markdown from "slack-markdown";
import * as dateFormat from "dateformat";
import { IMatrixMessage } from "./matrixtypes";

const MATRIX_TO_LINK = "https://matrix.to/#/";
const EMOJI_SIZE = 32;

const FLAG = "\x01";
const USER_INSERT_REGEX = /\x01user\x01([a-zA-Z0-9]*)\x01([^\x01]*)\x01/;
const ID_USER_INSERT_REGEX = 1;
const NAME_USER_INSERT_REGEX = 2;

const CHAN_INSERT_REGEX = /\x01chan\x01([a-zA-Z0-9]*)\x01([^\x01]*)\x01/;
const ID_CHAN_INSERT_REGEX = 1;
const NAME_CHAN_INSERT_REGEX = 2;

const USERGROUP_INSERT_REGEX = /\x01usergroup\x01([a-zA-Z0-9]*)\x01([^\x01]*)\x01/;
const ID_USERGROUP_INSERT_REGEX = 1;
const NAME_USERGROUP_INSERT_REGEX = 2;

export interface ISlackMessageParserEntity {
	mxid: string;
	name: string;
}

export interface ISlackMessageParserCallbacks {
	getUser: (id: string, name: string) => Promise<ISlackMessageParserEntity | null>;
	getChannel: (id: string, name: string) => Promise<ISlackMessageParserEntity | null>;
	getUsergroup: (id: string, name: string) => Promise<ISlackMessageParserEntity | null>;
	getTeam: (id: string, name: string) => Promise<ISlackMessageParserEntity | null>;
	urlToMxc: (url: string) => Promise<string | null>;
}

export interface ISlackMessageParserOpts {
	callbacks: ISlackMessageParserCallbacks;
	inBlock?: boolean;
}

interface ISlackMarkdownParserOpts {
	slackOnly?: boolean;
}

export class SlackMarkdownParser {
	public async parseMarkdown (
		opts: ISlackMessageParserOpts,
		mdOpts: ISlackMarkdownParserOpts,
		str: string,
	): Promise<string> {
		let content = markdown.toHTML(str, {
			slackOnly: mdOpts.slackOnly || false,
			escapeHTML: !mdOpts.slackOnly,
			slackCallbacks: this.getSlackeParseCallbacks(opts, mdOpts),
			noExtraSpanTags: true,
		});

		content = await this.InsertUserPills(opts, mdOpts, content);
		content = await this.InsertChannelPills(opts, mdOpts, content);
		content = await this.InsertUsergroupPills(opts, mdOpts, content);
		return content;
	}

	private async InsertUserPills (
		opts: ISlackMessageParserOpts,
		mdOpts: ISlackMarkdownParserOpts,
		content: string,
	): Promise<string> {
		let results = USER_INSERT_REGEX.exec(content);
		while (results !== null) {
			const id = results[ID_USER_INSERT_REGEX];
			const name = results[NAME_USER_INSERT_REGEX];
			const user = await opts.callbacks.getUser(id, name);
			let replace = "";
			if (user) {
				const url = MATRIX_TO_LINK + escapeHtml(user.mxid);
				replace = mdOpts.slackOnly ? user.name : `<a href="${url}">${escapeHtml(user.name)}</a>`;
			} else if (name) {
				replace = mdOpts.slackOnly ? name : escapeHtml(name);
			} else {
				replace = mdOpts.slackOnly ? `<@${id}>` : `&lt;@${escapeHtml(id)}&gt;`;
			}
			content = content.replace(results[0], replace);
			results = USER_INSERT_REGEX.exec(content);
		}
		return content;
	}

	private async InsertChannelPills (
		opts: ISlackMessageParserOpts,
		mdOpts: ISlackMarkdownParserOpts,
		content: string,
	): Promise<string> {
		let results = CHAN_INSERT_REGEX.exec(content);
		while (results !== null) {
			const id = results[ID_CHAN_INSERT_REGEX];
			const name = results[NAME_CHAN_INSERT_REGEX];
			const chan = await opts.callbacks.getChannel(id, name);
			let replace = "";
			if (chan) {
				const url = MATRIX_TO_LINK + escapeHtml(chan.mxid);
				replace = mdOpts.slackOnly ? "#" + chan.name : `<a href="${url}">${escapeHtml(chan.name)}</a>`;
			} else if (name) {
				replace = "#" + (mdOpts.slackOnly ? name : escapeHtml(name));
			} else {
				replace = mdOpts.slackOnly ? `<#${id}>` : `&lt;#${escapeHtml(id)}&gt;`;
			}
			content = content.replace(results[0], replace);
			results = CHAN_INSERT_REGEX.exec(content);
		}
		return content;
	}

	private async InsertUsergroupPills (
		opts: ISlackMessageParserOpts,
		mdOpts: ISlackMarkdownParserOpts,
		content: string,
	): Promise<string> {
		let results = USERGROUP_INSERT_REGEX.exec(content);
		while (results !== null) {
			const id = results[ID_USERGROUP_INSERT_REGEX];
			const name = results[NAME_USERGROUP_INSERT_REGEX];
			const usergroup = await opts.callbacks.getUsergroup(id, name);
			let replace = "";
			if (usergroup) {
				if (usergroup.mxid) {
					const url = MATRIX_TO_LINK + escapeHtml(usergroup.mxid);
					replace = mdOpts.slackOnly ? usergroup.name : `<a href="${url}">${escapeHtml(usergroup.name)}</a>`;
				} else {
					replace = mdOpts.slackOnly ? usergroup.name : escapeHtml(usergroup.name);
				}
			} else if (name) {
				replace = mdOpts.slackOnly ? name : escapeHtml(name);
			} else {
				replace = mdOpts.slackOnly ? `<!subteam^${id}>` : `&lt;!subteam^${escapeHtml(id)}&gt;`;
			}
			content = content.replace(results[0], replace);
			results = USERGROUP_INSERT_REGEX.exec(content);
		}
		return content;
	}

	private getSlackeParseCallbacks (
		opts: ISlackMessageParserOpts,
		mdOpts: ISlackMarkdownParserOpts,
	) {
		return {
			user: (node) => `${FLAG}user${FLAG}${node.id}${FLAG}${node.name}${FLAG}`,
			channel: (node) => `${FLAG}chan${FLAG}${node.id}${FLAG}${node.name}${FLAG}`,
			usergroup: (node) => `${FLAG}usergroup${FLAG}${node.id}${FLAG}${node.name}${FLAG}`,
			atHere: (node) => "@room",
			atChannel: (node) => "@room",
			atEveryone: (node) => "@room",
			date: (node) => node.fallback,
		};
	}
}

export class SlackBlocksParser {
	constructor(
		private markdownParser: SlackMarkdownParser,
	) { }

	public async parseBlocks(
		opts: ISlackMessageParserOpts,
		blocks: AllBlocks[],
	): Promise<string> {
		let retStr = "";
		for (const block of blocks) {
			retStr += await this.parseBlock(opts, block);
		}
		return retStr;
	}

	private async parseElement(
		opts: ISlackMessageParserOpts,
		element: ImageElement | PlainTextElement | MrkdwnElement,
	): Promise<string> {
		switch (element.type) {
			case "image": {
				const img = element as ImageElement;
				const mxc = await opts.callbacks.urlToMxc(img.image_url);
				const alt = escapeHtml(img.alt_text || "");
				if (!mxc) {
					return `<a href="${escapeHtml(img.image_url)}">${alt}</a>`;
				}
				return `<img alt="${alt}" title="${alt}" height="${EMOJI_SIZE}" src="${mxc}" />`;
			}
			case "mrkdwn": {
				// TODO: support verbatim flag
				const str = (element as MrkdwnElement).text;
				return await this.markdownParser.parseMarkdown(opts, { slackOnly: false }, str);
			}
			case "plain_text":
				// TODO: support emoji flag
				return escapeHtml((element as PlainTextElement).text);
		}
		return "";
	}

	private async parseBlock(
		opts: ISlackMessageParserOpts,
		block: AllBlocks,
	): Promise<string> {
		switch (block.type) {
			case "rich_text":
				return await this.parseBlocks(opts, (block as ISlackBlockRichText).elements);
			case "rich_text_section": {
				if (opts.inBlock) {
					return await this.parseBlocks(opts, (block as ISlackRichTextSection).elements);
				}
				opts.inBlock = true;
				const content = await this.parseBlocks(opts, (block as ISlackRichTextSection).elements);
				opts.inBlock = false;
				return `<p>${content}</p>`;
			}
			case "rich_text_preformatted":
				return `<pre><code>${await this.parseBlocks(opts, (block as ISlackRichTextPre).elements)}</code></pre>`;
			case "rich_text_quote":
				return `<blockquote>${await this.parseBlocks(opts, (block as ISlackRichTextQuote).elements)}</blockquote>`;
			case "rich_text_list": {
				const list = block as ISlackRichTextList;
				let parsedBlocks = "";
				opts.inBlock = true;
				for (const el of list.elements) {
					parsedBlocks += `<li>${await this.parseBlock(opts, el)}</li>`;
				}
				opts.inBlock = false;
				if (list.style === "ordered") {
					return `<ol start="${parseInt(((list.index || 0) + 1).toString(), 10)}">${parsedBlocks}</ol>`;
				} else {
					return `<ul>${parsedBlocks}</ul>`;
				}
				break;
			}
			case "text": {
				const text = block as ISlackBlockText;
				let content = escapeHtml(text.text);
				content = content.replace(/\n/g, "<br>");
				const tags: string[] = [];
				const propMap = {
					bold: "strong",
					italic: "em",
					strike: "del",
					code: "code",
				};
				if (text.style) {
					for (const prop in propMap) {
						if (propMap.hasOwnProperty(prop) && text.style[prop]) {
							tags.push(propMap[prop]);
						}
					}
				}
				const openTags = tags.map((tag) => `<${tag}>`).join("");
				tags.reverse();
				const closeTags = tags.map((tag) => `</${tag}>`).join("");
				return `${openTags}${content}${closeTags}`;
			}
			case "emoji": {
				const code = (block as ISlackBlockEmoji).name;
				let e = emoji.get(code);
				if (e === `:${code}:`) {
					e = emoji.get(code + "_face");
					if (e === `:${code}_face:`) {
						e = `:${code}:`;
					}
				}
				return escapeHtml(e);
			}
			case "link": {
				const link = block as ISlackBlockLink;
				const url = escapeHtml(link.url);
				const content = link.text ? escapeHtml(link.text) : url;
				return `<a href="${url}">${content}</a>`;
			}
			case "user": {
				const id = (block as ISlackBlockUser).user_id;
				const entity = await opts.callbacks.getUser(id, "");
				if (entity) {
					return `<a href="${MATRIX_TO_LINK}${escapeHtml(entity.mxid)}">${escapeHtml(entity.name)}</a>`;
				} else {
					return escapeHtml(`<@${id}>`);
				}
			}
			case "usergroup": {
				const id = (block as ISlackBlockUsergroup).usergroup_id;
				const entity = await opts.callbacks.getUsergroup(id, "");
				if (entity) {
					if (entity.mxid) {
						return `<a href="${MATRIX_TO_LINK}${escapeHtml(entity.mxid)}">${escapeHtml(entity.name)}</a>`;
					} else {
						return escapeHtml(entity.name);
					}
				} else {
					return escapeHtml(`<!subteam^${id}>`);
				}
			}
			case "channel": {
				const id = (block as ISlackBlockChannel).channel_id;
				const entity = await opts.callbacks.getChannel(id, "");
				if (entity) {
					return `<a href="${MATRIX_TO_LINK}${escapeHtml(entity.mxid)}">${escapeHtml(entity.name)}</a>`;
				} else {
					return escapeHtml(`<#${id}>`);
				}
			}
			case "team": {
				const id = (block as ISlackBlockTeam).team_id;
				const entity = await opts.callbacks.getTeam(id, "");
				if (entity) {
					return `<a href="${MATRIX_TO_LINK}${escapeHtml(entity.mxid)}">${escapeHtml(entity.name)}</a>`;
				} else {
					return escapeHtml(`<!team^${id}>`);
				}
			}
			case "date":
				return escapeHtml((block as ISlackBlockDate).fallback);
			case "color": {
				const c = escapeHtml((block as ISlackBlockColor).value);
				return `${c}<font color="${c}">\u25A0</font>`;
			}
			case "broadcast":
				return "@room";
			case "divider":
				return "<hr>";
			case "section": {
				const section = block as SectionBlock;
				let retStr = "";
				if (section.text) {
					retStr += `<p>${await this.parseElement(opts, section.text)}</p>`;
				}
				if (section.fields && section.fields.length > 0) {
					retStr += "<table><tr>";
					let i = 0;
					for (const field of section.fields) {
						retStr += `<td>${await this.parseElement(opts, field)}</td>`;
						// tslint:disable-next-line no-magic-numbers
						if ((i % 2) && i < section.fields.length - 1) {
							retStr += "</tr><tr>";
						}
						i++;
					}
					retStr += "</tr></table>";
				}
				return retStr;
			}
			case "image": {
				const image = block as ImageBlock;
				let retStr = "<p>";
				if (image.title) {
					retStr += await this.parseElement(opts, image.title) + "<br>";
				}
				const url = escapeHtml(image.image_url);
				retStr += `Image: <a href="${url}">${url}</a>`;
				retStr += "</p>";
				return retStr;
			}
			case "context": {
				const context = block as ContextBlock;
				let retStr = "<p>";
				for (const element of context.elements) {
					retStr += await this.parseElement(opts, element) + " ";
				}
				retStr += "</p>";
				return retStr;
			}
			default:
				return `Unsupported block of type ${block.type}`;
		}
	}
}

export class SlackMessageParser {
	private blocksParser: SlackBlocksParser;
	private markdownParser: SlackMarkdownParser;
	constructor() {
		this.markdownParser = new SlackMarkdownParser();
		this.blocksParser = new SlackBlocksParser(this.markdownParser);
	}

	public async FormatText(
		opts: ISlackMessageParserOpts,
		text: string,
	): Promise<IMatrixMessage> {
		return await this.FormatMessage(opts, { text });
	}

	public async FormatMessage(
		opts: ISlackMessageParserOpts,
		event: ISlackMessage,
	): Promise<IMatrixMessage> {
		const markdownPlain = async (str) => await this.markdownParser.parseMarkdown(opts, { slackOnly: true }, str);
		const markdownHtml = async (str) => await this.markdownParser.parseMarkdown(opts, { slackOnly: false }, str);
		const result = {
			msgtype: "m.text",
			body: "",
			format: "org.matrix.custom.html",
			formatted_body: "",
		} as IMatrixMessage;
		const text = unescapeHtml(event.text);
		result.body = await markdownPlain(text);
		if (event.blocks && event.blocks.length > 0) {
			result.formatted_body = await this.blocksParser.parseBlocks(opts, event.blocks);
		} else {
			result.formatted_body = await markdownHtml(text);
		}
		if (event.attachments && event.attachments.length > 0) {
			if (result.body !== "") {
				result.body += "\n";
				result.formatted_body += "<br>";
			}
			for (const attachment of event.attachments) {
				if (result.body !== "") {
					result.body += "---------------------\n";
					result.formatted_body += "<hr>";
				}
				result.formatted_body += "<p>";
				if (attachment.pretext) {
					result.body += (await markdownPlain(attachment.pretext)) + "\n";
					result.formatted_body += (await markdownHtml(attachment.pretext)) + "<br>";
				}
				if (attachment.author_name) {
					if (attachment.author_icon) {
						const mxc = await opts.callbacks.urlToMxc(attachment.author_icon);
						if (mxc) {
							result.formatted_body += `<img height="${EMOJI_SIZE}" src="${mxc}" /> `;
						}
					}
					let author_name = attachment.author_name;
					let author_link = attachment.author_link;
					if (attachment.author_id) {
						const author = await opts.callbacks.getUser(attachment.author_id, author_name);
						if (author) {
							author_name = author.name;
							author_link = MATRIX_TO_LINK + author.mxid;
						}
					}
					if (author_link) {
						result.body += `[${author_name}](${author_link})\n`;
						const name = escapeHtml(author_name);
						const link = escapeHtml(author_link);
						result.formatted_body += `<a href="${link}">${name}</a><br>`;
					} else {
						result.body += author_name + "\n";
						result.formatted_body += escapeHtml(author_name) + "<br>";
					}
				}
				if (attachment.title) {
					if (attachment.title_link) {
						result.body += `## [${attachment.title}](${attachment.title_link})\n`;
						const title = escapeHtml(attachment.title);
						const link = escapeHtml(attachment.title_link);
						result.formatted_body += `<strong><a href="${link}">${title}</a></strong>`;
					} else {
						result.body += `## ${attachment.title}\n`;
						result.formatted_body += `<strong>${escapeHtml(attachment.title)}</strong>`;
					}
				}
				if (attachment.text) {
					result.body += (await markdownPlain(attachment.text)) + "\n";
					result.formatted_body += (await markdownHtml(attachment.text)) + "<br>";
				}
				if (attachment.fields && attachment.fields.length > 0) {
					result.formatted_body += "<table><tr>";
					let i = 0;
					for (const field of attachment.fields) {
						result.body += `*${await markdownPlain(field.title)}*\n`;
						result.body += `${await markdownPlain(field.value)}\n`;;
						const title = await markdownHtml(field.title);
						const value = await markdownHtml(field.value);
						result.formatted_body += `<td><strong>${title}</strong><br>${value}</td>`;
						// tslint:disable-next-line no-magic-numbers
						if ((i % 2) && i < attachment.fields.length - 1) {
							result.formatted_body += "</tr><tr>";
						}
						i++;
					}
					result.formatted_body += "</tr></table>";
				}
				if (attachment.image_url) {
					result.body += `Image: ${attachment.image_url}\n`;
					const url = escapeHtml(attachment.image_url);
					result.formatted_body += `Image: <a href="${url}">${url}</a><br>`;
				}
				const footerParts: string[] = [];
				const footerPartsHtml: string[] = [];
				if (attachment.footer) {
					footerParts.push(await markdownPlain(attachment.footer));
					footerPartsHtml.push(await markdownHtml(attachment.footer));
				}
				if (attachment.ts) {
					const date = new Date(parseFloat(attachment.ts)*1000);
					const dateStr = dateFormat(date, "dS mmm yyyy 'at' H:MM Z");
					footerParts.push(dateStr);
					footerPartsHtml.push(escapeHtml(dateStr));
				}
				if (footerParts.length > 0) {
					result.body += footerParts.join(" | ") + "\n";
					result.formatted_body += `<sup>${footerParts.join(" | ")}</sup><br>`;
				}
				result.formatted_body += "</p>";
			}
		}
		return result;
	}
}
