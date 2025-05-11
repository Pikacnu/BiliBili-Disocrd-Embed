/**
 * B站影片資訊的主要介面
 * 包含影片的所有基本資訊、統計數據和相關設定
 */
export interface BilibiliVideoInfo {
	/** 影片的 BV 號，B站影片的唯一標識符 */
	bvid: string;
	/** 影片的 AV 號（數字ID） */
	aid: number;
	/** 包含的影片數量（例如多P視頻） */
	videos: number;
	/** 影片的分區 ID */
	tid: number;
	/** 影片的子分區 ID */
	tid_v2: number;
	/** 影片的分區名稱 */
	tname: string;
	/** 影片的子分區名稱 */
	tname_v2: string;
	/** 版權標識（1: 原創, 2: 轉載） */
	copyright: number;
	/** 影片封面圖片的 URL */
	pic: string;
	/** 影片標題 */
	title: string;
	/** 發布時間戳（秒） */
	pubdate: number;
	/** 建立時間戳（秒） */
	ctime: number;
	/** 影片描述文本 */
	desc: string;
	/** 結構化的影片描述 */
	desc_v2: DescV2Item[];
	/** 影片狀態（0: 正常） */
	state: number;
	/** 影片時長（秒） */
	duration: number;
	/** 活動任務 ID */
	mission_id: number;
	/** 影片權限相關信息 */
	rights: Rights;
	/** UP主信息 */
	owner: Owner;
	/** 影片統計數據 */
	stat: Stat;
	/** 爭議信息 */
	argue_info: ArgueInfo;
	/** 動態文本 */
	dynamic: string;
	/** 影片 CID，播放相關的唯一標識符 */
	cid: number;
	/** 影片分辨率信息 */
	dimension: Dimension;
	/** 首播信息，null 表示非首播 */
	premiere: null;
	/** 青少年模式標識 */
	teenage_mode: number;
	/** 是否為付費季度內容 */
	is_chargeable_season: boolean;
	/** 是否為故事模式 */
	is_story: boolean;
	/** 是否為 UPower 獨佔 */
	is_upower_exclusive: boolean;
	/** 是否為 UPower 播放 */
	is_upower_play: boolean;
	/** 是否為 UPower 預覽 */
	is_upower_preview: boolean;
	/** 是否啟用 VT */
	enable_vt: number;
	/** VT 顯示文本 */
	vt_display: string;
	/** 是否為帶問答的 UPower 獨佔 */
	is_upower_exclusive_with_qa: boolean;
	/** 是否禁用緩存 */
	no_cache: boolean;
	/** 影片分P信息 */
	pages: Page[];
	/** 字幕信息 */
	subtitle: Subtitle;
	/** 標籤信息 */
	label: Label;
	/** 是否顯示為季節性內容 */
	is_season_display: boolean;
	/** 用戶裝扮信息 */
	user_garb: UserGarb;
	/** 榮譽回覆信息 */
	honor_reply: HonorReply;
	/** 點讚圖標 */
	like_icon: string;
	/** 是否需要跳轉到 BV */
	need_jump_bv: boolean;
	/** 是否禁用顯示 UP 主信息 */
	disable_show_up_info: boolean;
	/** 是否為故事播放模式 */
	is_story_play: number;
	/** 是否為自己查看 */
	is_view_self: boolean;
}

/**
 * 結構化描述中的單個項目
 */
export interface DescV2Item {
	/** 原始文本內容 */
	raw_text: string;
	/** 文本類型 (1: 普通文本, 2: 用戶標記等) */
	type: number;
	/** 業務 ID，與 type 對應的唯一標識 */
	biz_id: number;
}

/**
 * 影片權限相關設定
 */
export interface Rights {
	/** 是否允許 B 幣付費 */
	bp: number;
	/** 是否開啟充電 */
	elec: number;
	/** 是否允許下載 (1: 允許) */
	download: number;
	/** 是否電影 */
	movie: number;
	/** 是否付費 */
	pay: number;
	/** 是否支持高清 5 (1080P+) */
	hd5: number;
	/** 是否禁止轉載 (1: 禁止) */
	no_reprint: number;
	/** 是否自動播放 */
	autoplay: number;
	/** 是否 UGC 付費 */
	ugc_pay: number;
	/** 是否為合作視頻 */
	is_cooperation: number;
	/** 是否 UGC 付費預覽 */
	ugc_pay_preview: number;
	/** 是否無背景 */
	no_background: number;
	/** 是否乾淨模式 */
	clean_mode: number;
	/** 是否命運石之門 */
	is_stein_gate: number;
	/** 是否 360 度全景 */
	is_360: number;
	/** 是否禁止分享 */
	no_share: number;
	/** 是否付費點播 */
	arc_pay: number;
	/** 是否免費觀看 */
	free_watch: number;
}

/**
 * UP主信息
 */
export interface Owner {
	/** UP主用戶 ID */
	mid: number;
	/** UP主用戶名 */
	name: string;
	/** UP主頭像 URL */
	face: string;
}

/**
 * 影片統計數據
 */
export interface Stat {
	/** 影片 AV 號 */
	aid: number;
	/** 播放量 */
	view: number;
	/** 彈幕數 */
	danmaku: number;
	/** 評論數 */
	reply: number;
	/** 收藏數 */
	favorite: number;
	/** 投幣數 */
	coin: number;
	/** 分享數 */
	share: number;
	/** 當前排名 */
	now_rank: number;
	/** 歷史最高排名 */
	his_rank: number;
	/** 點讚數 */
	like: number;
	/** 點踩數 */
	dislike: number;
	/** 評價內容 */
	evaluation: string;
	/** VT 計數 */
	vt: number;
}

/**
 * 爭議信息
 */
export interface ArgueInfo {
	/** 爭議消息內容 */
	argue_msg: string;
	/** 爭議類型 */
	argue_type: number;
	/** 爭議相關鏈接 */
	argue_link: string;
}

/**
 * 影片分辨率信息
 */
export interface Dimension {
	/** 寬度 (像素) */
	width: number;
	/** 高度 (像素) */
	height: number;
	/** 旋轉角度 (0: 不旋轉) */
	rotate: number;
}

/**
 * 影片分P信息
 */
export interface Page {
	/** 分P的 CID */
	cid: number;
	/** 分P序號，從 1 開始 */
	page: number;
	/** 來源標識 */
	from: string;
	/** 分P標題 */
	part: string;
	/** 分P時長 (秒) */
	duration: number;
	/** 外部視頻 ID */
	vid: string;
	/** 外部網頁鏈接 */
	weblink: string;
	/** 分P的分辨率信息 */
	dimension: Dimension;
	/** 首幀圖片 URL */
	first_frame: string;
	/** 創建時間戳 (秒) */
	ctime: number;
}

/**
 * 字幕作者信息
 */
export interface SubtitleAuthor {
	/** 用戶 ID */
	mid: number;
	/** 用戶名 */
	name: string;
	/** 性別 */
	sex: string;
	/** 頭像 URL */
	face: string;
	/** 個性簽名 */
	sign: string;
	/** 等級 */
	rank: number;
	/** 生日時間戳 */
	birthday: number;
	/** 是否為假帳號 */
	is_fake_account: number;
	/** 是否已刪除 */
	is_deleted: number;
	/** 是否在審核中 */
	in_reg_audit: number;
	/** 是否為高級會員 */
	is_senior_member: number;
	/** 名稱渲染信息 */
	name_render: null;
}

/**
 * 字幕項目信息
 */
export interface SubtitleItem {
	/** 字幕 ID */
	id: number;
	/** 語言代碼 */
	lan: string;
	/** 語言名稱 */
	lan_doc: string;
	/** 是否鎖定 */
	is_lock: boolean;
	/** 字幕文件 URL */
	subtitle_url: string;
	/** 字幕類型 */
	type: number;
	/** 字幕 ID (字符串形式) */
	id_str: string;
	/** AI 類型 */
	ai_type: number;
	/** AI 狀態 */
	ai_status: number;
	/** 字幕作者信息 */
	author: SubtitleAuthor;
}

/**
 * 字幕總體信息
 */
export interface Subtitle {
	/** 是否允許提交字幕 */
	allow_submit: boolean;
	/** 字幕列表 */
	list: SubtitleItem[];
}

/**
 * 標籤信息
 */
export interface Label {
	/** 標籤類型 */
	type: number;
}

/**
 * 用戶裝扮信息
 */
export interface UserGarb {
	/** 動態裁剪圖片 URL */
	url_image_ani_cut: string;
}

/**
 * 榮譽信息
 */
export interface Honor {
	/** 影片 AV 號 */
	aid: number;
	/** 榮譽類型 (3: 排行榜, 7: 熱門收錄) */
	type: number;
	/** 榮譽描述文本 */
	desc: string;
	/** 每週推薦數量 */
	weekly_recommend_num: number;
}

/**
 * 榮譽回覆信息
 */
export interface HonorReply {
	/** 榮譽列表 */
	honor: Honor[];
}

export enum VideoQuality {
	_240P = 6,
	_360P = 16,
	_480P = 32,
	_720P = 64,
	_720P60 = 74,
	_1080P = 80,
	_SUPER_RESOLUTION = 100,
	_1080P_HIGH = 112,
	_1080P60 = 116,
	_4K = 120,
	_HDR = 125,
	_DOLBY = 126,
	_8K = 127,
}

export const VideoQualityText: Record<VideoQuality, string> = {
	[VideoQuality._240P]: '240P',
	[VideoQuality._360P]: '360P',
	[VideoQuality._480P]: '480P',
	[VideoQuality._720P]: '720P',
	[VideoQuality._720P60]: '720P 60FPS',
	[VideoQuality._1080P]: '1080P',
	[VideoQuality._SUPER_RESOLUTION]: '超分辨率',
	[VideoQuality._1080P_HIGH]: '1080P 高碼率',
	[VideoQuality._1080P60]: '1080P 60FPS',
	[VideoQuality._4K]: '4K',
	[VideoQuality._HDR]: 'HDR',
	[VideoQuality._DOLBY]: '杜比',
	[VideoQuality._8K]: '8K',
};

export enum AudioQuality {
	_64K = 30216,
	_132K = 30232,
	_192K = 30280,
	_DOLBY = 30250,
	_HI_RES = 30251,
}

export const AudioQualityText: Record<AudioQuality, string> = {
	[AudioQuality._64K]: '64K',
	[AudioQuality._132K]: '132K',
	[AudioQuality._192K]: '192K',
	[AudioQuality._DOLBY]: '杜比',
	[AudioQuality._HI_RES]: '高解析度',
};

export enum VideoFormats {
	_FLV = 0,
	_MP4 = 1,
	_DASH = 16,
	_HDR = 32,
	_4K = 128,
	_DOLBY_Audio = 256,
	_DOLBY_Video = 512,
	_8K = 1024,
	_AV1 = 2048,
}

/**
 * 影片播放資訊類型
 */
export interface VideoPlayInfo {
	/** 請求結果狀態 */
	from: string;
	/** 結果狀態 */
	result: string;
	/** 狀態訊息 */
	message: string;
	/** 影片品質 */
	quality: number;
	/** 影片格式 */
	format: string;
	/** 影片時長 (毫秒) */
	timelength: number;
	/** 可接受的格式列表 */
	accept_format: string;
	/** 品質描述列表 */
	accept_description: string[];
	/** 可接受的品質列表 */
	accept_quality: VideoQuality[];
	/** 影片編碼ID */
	video_codecid: number;
	/** 跳轉參數名稱 */
	seek_param: string;
	/** 跳轉參數類型 */
	seek_type: string;
	/** DASH格式串流資訊 */
	dash?: DashInfo;
	/** 下載URL列表 */
	durl: VideoDownloadURL[];
	/** 支援的格式列表 */
	support_formats: SupportFormat[];
	/** 高品質格式 */
	high_format: null | any;
	/** 上次播放時間 */
	last_play_time: number;
	/** 上次播放的CID */
	last_play_cid: number;
	/** 觀看信息 */
	view_info: null | any;
	/** 播放配置 */
	play_conf: {
		/** 是否為新描述 */
		is_new_description: boolean;
	};
}

/**
 * DASH格式串流資訊
 */
export interface DashInfo {
	/** 影片時長 (秒) */
	duration: number;
	/** 最小緩衝時間 */
	minBufferTime: number;
	/** 最小緩衝時間 (別名) */
	min_buffer_time: number;
	/** 影片軌道列表 */
	video: DashVideoItem[];
	/** 音訊軌道列表 */
	audio: DashAudioItem[];
	/** 杜比音效資訊 */
	dolby: {
		/** 杜比音效類型 */
		type: number;
		/** 杜比音訊資訊 */
		audio: null | any;
	};
	/** FLAC高品質音訊 */
	flac: null | any;
}

/**
 * DASH影片項目
 */
export interface DashVideoItem {
	/** 影片ID */
	id: number;
	/** 基礎URL */
	baseUrl: string;
	/** 基礎URL (別名) */
	base_url: string;
	/** 備用URL列表 */
	backupUrl: string[];
	/** 備用URL列表 (別名) */
	backup_url: string[];
	/** 頻寬 */
	bandwidth: number;
	/** 影片編碼ID */
	codecid: number;
	/** 影片編碼名稱 */
	codecs: string;
	/** 影片寬度 */
	width: number;
	/** 影片高度 */
	height: number;
	/** 幀率 */
	frameRate: string;
	/** 幀率 (別名) */
	frame_rate: string;
	/** 影片品質 */
	quality: VideoQuality;
	/** MIME 類型 */
	mimeType: string;
	/** MIME 類型 (別名) */
	mime_type: string;
	/** 畫面比例 */
	sar: string;
	/** 是否以 SAP 開始 */
	startWithSap: number;
	/** 是否以 SAP 開始 (別名) */
	start_with_sap: number;
	/** 分段基礎信息 */
	SegmentBase: {
		/** 初始化範圍 */
		Initialization: string;
		/** 索引範圍 */
		indexRange: string;
	};
	/** 分段基礎信息 (別名) */
	segment_base: {
		/** 初始化範圍 */
		initialization: string;
		/** 索引範圍 */
		index_range: string;
	};
}

/**
 * DASH音訊項目
 */
export interface DashAudioItem {
	/** 音訊ID */
	id: number;
	/** 基礎URL */
	baseUrl: string;
	/** 基礎URL (別名) */
	base_url: string;
	/** 備用URL列表 */
	backupUrl: string[];
	/** 備用URL列表 (別名) */
	backup_url: string[];
	/** 頻寬 */
	bandwidth: number;
	/** 音訊編碼ID */
	codecid: number;
	/** 音訊編碼名稱 */
	codecs: string[] | string;
	/** 音訊品質 */
	quality: AudioQuality;
}

/**
 * 影片下載URL資訊
 */
export interface VideoDownloadURL {
	/** 序號 */
	order: number;
	/** 影片長度 (毫秒) */
	length: number;
	/** 檔案大小 (位元組) */
	size: number;
	/** ahead 參數 */
	ahead: string;
	/** vhead 參數 */
	vhead: string;
	/** 影片URL */
	url: string;
	/** 備用URL列表 */
	backup_url: string[];
}

/**
 * 支援的影片格式
 */
export interface SupportFormat {
	/** 品質等級 */
	quality: VideoQuality;
	/** 格式名稱 */
	format: string;
	/** 新描述 */
	new_description: string;
	/** 顯示描述 */
	display_desc: string;
	/** 上標文字 */
	superscript: string;
	/** 編解碼器 */
	codecs: null | string[];
}

export interface BilibiliLoginKey {
	/*密碼 salt */
	hash: string;
	/* RSA 公鑰 */
	key: string;
}

export type BilibiliResponse<T> = {
	code: number;
	message: string;
	data: T;
};

export type CookieInfoResponse = {
	/* 是否應該刷新cookie */
	refresh: boolean;
	/*timestamp */
	timestamp: number;
};

export type RefreshCookieResponse = {
	status: number;
	message: string;
	refresh_token: string;
};

export enum BilibiliVideoIdType {
	bvid,
	avid,
	epid,
	season,
	episode,
	unknown,
}

export enum BilibiliPlatform {
	html5 = 'html5',
	dash = 'dash',
}
