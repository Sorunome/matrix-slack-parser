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

import { MessageAttachment, KnownBlock, Block } from "@slack/types";

export interface ISlackBlockText extends Block {
	type: "text";
	text: string;
	style?: {
		bold?: boolean; // bold text
		italic?: boolean; // italic text
		strike?: boolean; // del text
		code?: boolean; // code text
	};
}

// emoji
export interface ISlackBlockEmoji extends Block {
	type: "emoji";
	name: string;
	skin_tone?: string;
}

// links
export interface ISlackBlockLink extends Block {
	type: "link";
	url: string;
	text?: string;
}

// user mentions
export interface ISlackBlockUser extends Block {
	type: "user";
	user_id: string;
}

// usergroup mentions
export interface ISlackBlockUsergroup extends Block {
	type: "usergroup";
	usergroup_id: string;
}

// channel mentions
export interface ISlackBlockChannel extends Block {
	type: "channel";
	channel_id: string;
}

// team mentions
export interface ISlackBlockTeam extends Block {
	type: "team";
	team_id: string;
}

// broadcast mentions
export interface ISlackBlockBroadcast extends Block {
	type: "broadcast";
	range: "here" | "channel" | "everyone";
}

// color block???
export interface ISlackBlockColor extends Block {
	type: "color";
	value?: string; // ???
}

// date block???
export interface ISlackBlockDate extends Block {
	type: "date";
	timestamp: string;
	format: string;
	fallback?: string;
}

// zoom call
export interface ISlackBlockCall extends Block {
	type: "call";
	call: {
		v1: {
			join_url: string;
			name: string;
		}
	};
}

// normal paragraph
export interface ISlackRichTextSection extends Block {
	type: "rich_text_section";
	elements: AllBlocks[];
}

// <pre><code>
export interface ISlackRichTextPre extends Block {
	type: "rich_text_preformatted";
	elements: AllBlocks[];
}

// <blockquote>
export interface ISlackRichTextQuote extends Block {
	type: "rich_text_quote";
	elements: AllBlocks[];
}

// <ul>, <ol>
export interface ISlackRichTextList extends Block {
	type: "rich_text_list";
	elements: AllBlocks[];
	style: "ordered" | "bullet";
	index?: number;
	indent?: number;
}

export interface ISlackBlockRichText extends Block {
	type: "rich_text";
	elements: AllBlocks[];
}

export type AllBlocks = KnownBlock | ISlackBlockRichText | ISlackRichTextSection | ISlackBlockText | ISlackBlockEmoji
	| ISlackRichTextPre | ISlackRichTextQuote | ISlackRichTextList | ISlackBlockUser | ISlackBlockChannel
	| ISlackBlockBroadcast | ISlackBlockLink | ISlackBlockUsergroup | ISlackBlockColor | ISlackBlockDate
	| ISlackBlockTeam | ISlackBlockCall;

export interface ISlackMessageAttachment extends MessageAttachment {
	author_id?: string;
}

export interface ISlackMessage {
	text: string;
	blocks?: AllBlocks[];
	attachments?: ISlackMessageAttachment[];
	thread_ts?: string;
	mrkdwn?: boolean;
}
