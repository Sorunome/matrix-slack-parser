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

import * as Parser from "node-html-parser";
import { Util } from "./util";
import { IMatrixMessage } from "./matrixtypes";
import {
	ISlackMessage, AllBlocks, ISlackBlockText, ISlackBlockBroadcast, ISlackRichTextQuote, ISlackRichTextPre,
	ISlackBlockLink, ISlackBlockUser, ISlackBlockChannel, ISlackRichTextSection,
} from "./slacktypes";
import * as escapeHtml from "escape-html";
import * as unescapeHtml from "unescape-html";

const MATRIX_TO_LINK = "https://matrix.to/#/";

export interface IMatrixMessageParserCallbacks {
	canNotifyRoom: () => Promise<boolean>;
	getUserId: (mxid: string) => Promise<string | null>;
	getChannelId: (mxid: string) => Promise<string | null>;
	mxcUrlToHttp: (mxc: string) => string;
}

interface IMatrixMessageParserStyle {
	bold: number;
	italic: number;
	strike: number;
	code: number;
}

export interface IMatrixMessageParserOpts {
	callbacks: IMatrixMessageParserCallbacks;
	listDepth?: number;
	style?: IMatrixMessageParserStyle;
}

interface IRes {
	text: string;
	blocks: AllBlocks[];
}

export class MatrixMessageParser {
	private listBulletPoints: string[] = ["●", "○", "■", "‣"];
	public async FormatMessage(
		opts: IMatrixMessageParserOpts,
		eventContent: IMatrixMessage,
	): Promise<IRes> {
		opts.style = {
			bold: 0,
			italic: 0,
			strike: 0,
			code: 0,
		};
		let result: IRes;
		if (eventContent.formatted_body) {
			// init opts
			opts.listDepth = 0;
			// parser needs everything in html elements
			// so we wrap everything in <div> just to be sure that all is wrapped
			const parsed = Parser.parse(eventContent.formatted_body, {
				lowerCaseTagName: true,
				pre: true,
			} as any); // tslint:disable-line no-any
			result = await this.walkNode(opts, parsed);
		} else {
			result = await this.escapeSlack(opts, escapeHtml(eventContent.body));
		}
		result.text = result.text.replace(/\s*$/, ""); // trim off whitespace at end
		result.blocks = [{
			type: "rich_text",
			elements: this.cleanupBlocks(result.blocks),
		}];
		return result;
	}

	private async escapeSlack(opts: IMatrixMessageParserOpts, msg: string): Promise<IRes> {
		msg = unescapeHtml(msg);
		const plainMsg = msg;
		const canHighlight = plainMsg.includes("@room") && await opts.callbacks.canNotifyRoom();
		// first we want to construct the "msg", which is the text representative
		const escapeChars = ["*", "_", "~", "`"];
		const escapeSlackInternal = (s: string): string => {
			if (s.includes("@room") && canHighlight) {
				s = s.replace("@room", "<!channel>");
			}
			const match = s.match(/\bhttps?:\/\//);
			if (match) {
				return escapeSlackInternal(s.substring(0, match.index)) + s.substring(match.index as number);
			}
			escapeChars.forEach((char) => {
				s = s.replace(new RegExp("\\" + char, "g"), `\ufff1${char}\ufff1`);
			});
			return s;
		}
		const parts: string[] = msg.split(/\s/).map(escapeSlackInternal);
		const whitespace = msg.replace(/\S/g, "");
		msg = parts[0];
		for (let i = 0; i < whitespace.length; i++) {
			msg += whitespace[i] + parts[i + 1];
		}
		// next we want to construct the blocks
		let style: any | undefined; // tslint:disable-line no-any
		for (const s of ["bold", "italic", "strike", "code"]) {
			if (opts.style![s] > 0) {
				if (!style) {
					style = {};
				}
				style[s] = true;
			}
		}
		const escapeSlackBlockInternal = (s: string): AllBlocks[] | AllBlocks => {
			const matchRoom = s.match(/(.*)@room(.*)/);
			if (matchRoom && canHighlight) {
				const MATCH_BEFORE = 1;
				const MATCH_AFTER = 2;
				return [
					{
						type: "text",
						text: matchRoom[MATCH_BEFORE],
						style,
					},
					{
						type: "broadcast",
						range: "channel",
					},
					{
						type: "text",
						text: matchRoom[MATCH_AFTER],
						style,
					},
				];
			}
			const matchUrl = s.match(/\bhttps?:\/\//);
			if (matchUrl) {
				return [
					{
						type: "text",
						text: s.substring(0, matchUrl.index),
						style,
					},
					{
						type: "link",
						url: s.substring(matchUrl.index as number),
					}
				];
			}
			return {
				type: "text",
				text: s,
				style,
			};
		};
		const blockParts: (AllBlocks | AllBlocks[])[] = plainMsg.split(/\s/).map(escapeSlackBlockInternal); // we may not flatten *yet*, as we still need to insert the whitespace
		const blockWhitespace = plainMsg.replace(/\S/g, "");
		const blocks: AllBlocks[] = [];
		if (Array.isArray(blockParts[0])) {
			for (const b of blockParts[0]) {
				blocks.push(b);
			}
		} else {
			blocks.push(blockParts[0]);
		}
		for (let i = 0; i < blockWhitespace.length; i++) {
			blocks.push({
				type: "text",
				text: blockWhitespace[i],
				style,
			});
			const b = blockParts[i + 1];
			if (Array.isArray(b)) {
				for (const bb of b) {
					blocks.push(bb);
				}
			} else {
				blocks.push(b);
			}
		}
		return {
			text: msg,
			blocks,
		};
	}

	private parsePreContent(opts: IMatrixMessageParserOpts, node: Parser.HTMLElement): IRes {
		let text = node.text;
		const match = text.match(/^<code([^>]*)>/i);
		if (!match) {
			if (text[text.length - 1] === "\n") {
				text = text.slice(0, -1);
			}
			return {
				text: `\`\`\`${text}\`\`\`\n`,
				blocks: [{
					type: "rich_text_preformatted",
					elements: [{
						type: "text",
						text,
					} as ISlackBlockText],
				} as ISlackRichTextPre],
			} as IRes;
		}
		// remove <code> opening-tag
		text = text.substr(match[0].length);
		// remove </code> closing tag
		text = text.replace(/<\/code>$/i, "");
		if (text[text.length - 1] === "\n") {
			text = text.slice(0, -1);
		}
		// slack doesn't support code language
		return {
			text: `\`\`\`${text}\`\`\`\n`,
			blocks: [{
				type: "rich_text_preformatted",
				elements: [{
					type: "text",
					text,
				} as ISlackBlockText],
			} as ISlackRichTextPre],
		} as IRes;
	}

	private async parseLinkContent(opts: IMatrixMessageParserOpts, node: Parser.HTMLElement): Promise<IRes> {
		const attrs = node.attributes;
		const content = await this.walkChildNodes(opts, node);
		if (!attrs.href || content.text === attrs.href) {
			return content;
		}
		return {
			text: `<${attrs.href}|${content.text}>`,
			blocks: [{
				type: "link",
				text: content.text,
				url: attrs.href,
			} as ISlackBlockLink],
		} as IRes;
	}

	private async parseUser(opts: IMatrixMessageParserOpts, id: string): Promise<IRes> {
		const retId = await opts.callbacks.getUserId(id);
		if (!retId) {
			return {
				text: "",
				blocks: [],
			} as IRes;
		}
		return {
			text: `<@${retId}>`,
			blocks: [{
				type: "user",
				user_id: retId,
			} as ISlackBlockUser],
		} as IRes;
	}

	private async parseChannel(opts: IMatrixMessageParserOpts, id: string): Promise<IRes> {
		const retId = await opts.callbacks.getChannelId(id);
		if (!retId) {
			return {
				text: "",
				blocks: [],
			} as IRes;
		}
		return {
			text: `<#${retId}>`,
			blocks: [{
				type: "channel",
				channel_id: retId,
			} as ISlackBlockChannel],
		} as IRes;
	}

	private async parsePillContent(opts: IMatrixMessageParserOpts, node: Parser.HTMLElement): Promise<IRes> {
		const attrs = node.attributes;
		if (!attrs.href || !attrs.href.startsWith(MATRIX_TO_LINK)) {
			return await this.parseLinkContent(opts, node);
		}
		const id = attrs.href.replace(MATRIX_TO_LINK, "");
		let reply: IRes | null = null;
		switch (id[0]) {
			case "@":
				// user pill
				reply = await this.parseUser(opts, id);
				break;
			case "#":
				reply = await this.parseChannel(opts, id);
				break;
		}
		if (!reply || !reply.text) {
			return await this.parseLinkContent(opts, node);
		}
		return reply;
	}

	private async parseImageContent(opts: IMatrixMessageParserOpts, node: Parser.HTMLElement): Promise<IRes> {
		const EMOTE_NAME_REGEX = /^:?(\w+):?/;
		const attrs = node.attributes;
		const name = await this.escapeSlack(opts, attrs.alt || attrs.title || "");
		const url = opts.callbacks.mxcUrlToHttp(attrs.src || "");
		if (attrs.src) {
			const linkBlock = {
				type: "link",
				url,
			} as ISlackBlockLink;
			if (name.text) {
				linkBlock.text = name.text;
			}
			return {
				text: name.text ? `<${url}|${name.text}>` : `<${url}>`,
				blocks: [linkBlock],
			} as IRes;
		}
		return name;
	}

	private async parseBlockquoteContent(
		opts: IMatrixMessageParserOpts,
		node: Parser.HTMLElement,
	): Promise<IRes> {
		const ret = await this.walkChildNodes(opts, node);
		let msg = ret.text;

		msg = msg.split("\n").map((s) => {
			return "> " + s;
		}).join("\n");
		msg = msg + "\n\n"; // when we receive we don't have an extra newline, here we need it....

		const result = {
			text: msg,
			blocks: [{
				type: "rich_text_quote",
				elements: ret.blocks,
			} as ISlackRichTextQuote]
		} as IRes;
		return result;
	}

	private async parseSpanContent(opts: IMatrixMessageParserOpts, node: Parser.HTMLElement): Promise<IRes> {
		const content = await this.walkChildNodes(opts, node);
		const attrs = node.attributes;
		if (attrs["data-mx-spoiler"] !== undefined) {
			const spoilerReason = attrs["data-mx-spoiler"];
			if (spoilerReason) {
				return {
					text: `(Spoiler for ${spoilerReason}: ${content.text})`,
					blocks: [
						{
							type: "text",
							text: `(Spoiler for ${spoilerReason}: `,
						} as ISlackBlockText,
						...content.blocks,
						{
							type: "text",
							text: ")",
						} as ISlackBlockText,
					],
				} as IRes;
			}
			return {
				text: `(Spoiler: ${content.text})`,
				blocks: [
					{
						type: "text",
						text: "(Spoiler: ",
					} as ISlackBlockText,
					...content.blocks,
					{
						type: "text",
						text: ")",
					} as ISlackBlockText,
				],
			} as IRes;
		}
		return content;
	}

	private async parseUlContent(opts: IMatrixMessageParserOpts, node: Parser.HTMLElement): Promise<IRes> {
		opts.listDepth!++;
		const entries = await this.arrayChildNodes(opts, node, ["LI"]);
		opts.listDepth!--;
		const bulletPoint = this.listBulletPoints[opts.listDepth! % this.listBulletPoints.length];

		let blocks: AllBlocks[] = [];
		let msg = entries.map((s) => {
			if (opts.listDepth! === 0) {
				blocks = [...blocks, ...this.cleanupBlocks(s.blocks)];
			} else {
				blocks = [
					...blocks,
					{
						type: "text",
						text: `${"    ".repeat(opts.listDepth!)}${bulletPoint} `,
					},
					...s.blocks,
					{
						type: "text",
						text: "\n",
					},
				];
			}
			return `${"    ".repeat(opts.listDepth!)}${bulletPoint} ${s.text}`;
		}).join("\n");

		if (opts.listDepth! === 0) {
			msg = `\n${msg}\n\n`;
			return {
				text: msg,
				blocks: [{
					type: "rich_text_list",
					elements: blocks,
					style: "bullet",
					indent: opts.listDepth,
				}],
			} as IRes;
		} else {
			return {
				text: msg,
				blocks,
			};
		}
	}

	private async parseOlContent(opts: IMatrixMessageParserOpts, node: Parser.HTMLElement): Promise<IRes> {
		opts.listDepth!++;
		const entries = await this.arrayChildNodes(opts, node, ["LI"]);
		opts.listDepth!--;
		let entry = 0;
		const attrs = node.attributes;
		let startEntry = 0;
		if (attrs.start && attrs.start.match(/^[0-9]+$/)) {
			startEntry = entry = parseInt(attrs.start, 10) - 1;
		}

		let blocks: AllBlocks[] = [];
		let msg = entries.map((s) => {
			entry++;
			if (opts.listDepth! === 0) {
				blocks = [...blocks, ...this.cleanupBlocks(s.blocks)];
			} else {
				blocks = [
					...blocks,
					{
						type: "text",
						text: `${"    ".repeat(opts.listDepth!)}${entry}. `,
					},
					...s.blocks,
					{
						type: "text",
						text: "\n",
					},
				];
			}
			return `${"    ".repeat(opts.listDepth!)}${entry}. ${s.text}`;
		}).join("\n");

		if (opts.listDepth! === 0) {
			msg = `\n${msg}\n\n`;
			return {
				text: msg,
				blocks: [{
					type: "rich_text_list",
					elements: blocks,
					style: "ordered",
					indent: opts.listDepth,
				}],
			} as IRes;
		} else {
			return {
				text: msg,
				blocks,
			};
		}
	}

	private async arrayChildNodes(
		opts: IMatrixMessageParserOpts,
		node: Parser.Node,
		types: string[] = [],
	): Promise<IRes[]> {
		const replies: IRes[] = [];
		await Util.AsyncForEach(node.childNodes, async (child) => {
			if (types.length && (
				child.nodeType === Parser.NodeType.TEXT_NODE
				|| !types.includes((child as Parser.HTMLElement).tagName)
			)) {
				return;
			}
			replies.push(await this.walkNode(opts, child));
		});
		return replies;
	}

	private mergeTextBlocks(blocks: AllBlocks[]): AllBlocks[] {
		const getStyleStr = (style?: any): string => { // tslint:disable-line no-any
			if (!style) {
				return "";
			}
			let s = "";
			if (style.bold) {
				s += "b";
			}
			if (style.italic) {
				s += "i";
			}
			if (style.strike) {
				s += "s";
			}
			if (style.code) {
				s += "c";
			}
			return s;
		};
		const retBlocks: AllBlocks[] = [];
		let blocksStack: ISlackBlockText[] = [];
		let curStyleStr = "invalid";
		for (const block of blocks) {
			if (block.type !== "text" ||
				(block.type === "text" && curStyleStr !== getStyleStr((block as ISlackBlockText).style))) {
				if (blocksStack.length > 0) {
					const text = blocksStack.map((b) => b.text).join("");
					if (text) {
						const style = blocksStack[0].style;
						const newBlock = {
							type: "text",
							text,
						} as ISlackBlockText;
						if (style) {
							newBlock.style = style;
						}
						retBlocks.push(newBlock);
					}
					blocksStack = [];
				}
				if (block.type === "text") {
					curStyleStr = getStyleStr((block as ISlackBlockText).style);
					blocksStack.push(block);
				} else {
					retBlocks.push(block);
				}
			} else {
				blocksStack.push(block);
			}
		}
		if (blocksStack.length > 0) {
			const text = blocksStack.map((b) => b.text).join("");
			if (text) {
				const style = blocksStack[0].style;
				const newBlock = {
					type: "text",
					text,
				} as ISlackBlockText;
				if (style) {
					newBlock.style = style;
				}
				retBlocks.push(newBlock);
			}
		}
		return retBlocks;
	}

	private cleanupBlocks(blocks: AllBlocks[], force: boolean = true): AllBlocks[] {
		blocks = this.mergeTextBlocks(blocks);
		const richTextSections = ["rich_text_section", "rich_text_preformatted", "rich_text_quote", "rich_text_list"];
		if (!force) {
			let needToRelocate = false;
			for (const block of blocks) {
				if (richTextSections.includes(block.type)) {
					needToRelocate = true;
					break;
				}
			}
			if (!needToRelocate) {
				return blocks;
			}
		}
		const retBlocks: AllBlocks[] = [];
		let blocksStack: AllBlocks[] = [];
		for (const block of blocks) {
			if (richTextSections.includes(block.type)) {
				if (blocksStack.length > 0) {
					retBlocks.push({
						type: "rich_text_section",
						elements: blocksStack,
					} as ISlackRichTextSection);
					blocksStack = [];
				}
				retBlocks.push(block);
			} else {
				blocksStack.push(block);
			}
		}
		if (blocksStack.length > 0) {
			retBlocks.push({
				type: "rich_text_section",
				elements: blocksStack,
			} as ISlackRichTextSection);
		}
		return retBlocks;
	}

	private async walkChildNodes(opts: IMatrixMessageParserOpts, node: Parser.Node): Promise<IRes> {
		const reply = {
			text: "",
			blocks: [],
		} as IRes;
		let lastTag = "";
		await Util.AsyncForEach(node.childNodes, async (child) => {
			const thisTag = child.nodeType === Parser.NodeType.ELEMENT_NODE
				? (child as Parser.HTMLElement).tagName : "";
			if (thisTag === "P" && lastTag === "P") {
				reply.text += "\n\n";
				reply.blocks.push({
					type: "text",
					text: "\n\n",
				});
			}
			const ret = await this.walkNode(opts, child);
			reply.text += ret.text;
			reply.blocks = [...reply.blocks, ...ret.blocks];
			lastTag = thisTag;
		});
		reply.blocks = this.cleanupBlocks(reply.blocks, false);
		return reply;
	}

	private async walkNode(opts: IMatrixMessageParserOpts, node: Parser.Node): Promise<IRes> {
		if (node.nodeType === Parser.NodeType.TEXT_NODE) {
			// ignore \n between single nodes
			if ((node as Parser.TextNode).text === "\n") {
				return {
					text: "",
					blocks: [],
				} as IRes;
			}
			return await this.escapeSlack(opts, (node as Parser.TextNode).text);
		} else if (node.nodeType === Parser.NodeType.ELEMENT_NODE) {
			const nodeHtml = node as Parser.HTMLElement;
			switch (nodeHtml.tagName) {
				case "EM":
				case "I": {
					opts.style!.italic++;
					const res = await this.walkChildNodes(opts, nodeHtml);
					opts.style!.italic--;
					res.text = `_${res.text}_`;
					return res;
				}
				case "STRONG":
				case "B": {
					opts.style!.bold++;
					const res = await this.walkChildNodes(opts, nodeHtml);
					opts.style!.bold--;
					res.text = `*${res.text}*`;
					return res;
				}
				case "DEL":
				case "STRIKE":
				case "S": {
					opts.style!.strike++;
					const res = await this.walkChildNodes(opts, nodeHtml);
					opts.style!.strike--;
					res.text = `~${res.text}~`;
					return res;
				}
				case "CODE": {
					opts.style!.code++;
					const res = await this.walkChildNodes(opts, nodeHtml);
					opts.style!.code--;
					res.text = `\`${res.text}\``;
					return res;
				}
				case "PRE":
					return this.parsePreContent(opts, nodeHtml);
				case "A":
					return await this.parsePillContent(opts, nodeHtml);
				case "IMG":
					return await this.parseImageContent(opts, nodeHtml);
				case "BR":
					return {
						text: "\n",
						blocks: [{
							type: "text",
							text: "\n",
						} as ISlackBlockText]
					} as IRes;
				case "BLOCKQUOTE":
					return await this.parseBlockquoteContent(opts, nodeHtml);
				case "UL":
					return await this.parseUlContent(opts, nodeHtml);
				case "OL":
					return await this.parseOlContent(opts, nodeHtml);
				case "MX-REPLY":
					return {
						text: "",
						blocks: [],
					} as IRes;
				case "HR":
					return {
						text: "\n----------\n",
						blocks: [{
							type: "text",
							text: "\n----------\n",
						}],
					} as IRes;
				case "H1":
				case "H2":
				case "H3":
				case "H4":
				case "H5":
				case "H6": {
					opts.style!.bold++;
					const level = parseInt(nodeHtml.tagName[1], 10);
					const res = await this.walkChildNodes(opts, nodeHtml);
					opts.style!.bold--;
					return {
						text: `*${"#".repeat(level)} ${res.text}*\n`,
						blocks: [
							{
								type: "text",
								text: `${"#".repeat(level)} `,
								style: { bold: true },
							},
							...res.blocks,
							{
								type: "text",
								text: "\n",
							},
						],
					} as IRes;
				}
				case "SPAN":
					return await this.parseSpanContent(opts, nodeHtml);
				default:
					return await this.walkChildNodes(opts, nodeHtml);
			}
		}
		return {
			text: "",
			blocks: [],
		};
	}
}
