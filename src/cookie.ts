import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export type BilibiliResponse<T> = {
	code: number;
	message: string;
	data: T;
};

/**
 * QR Code 狀態枚舉
 */
export enum QRCodeStatus {
	/** 未掃描 */
	PENDING = 86101,
	/** 已掃描未確認 */
	SCANNED = 86090,
	/** 已確認 */
	CONFIRMED = 0,
	/** 已過期 */
	EXPIRED = 86038,
}

/**
 * QR Code 生成回應
 */
interface QRCodeGenerateResponse {
	url: string;
	qrcode_key: string;
}

/**
 * QR Code 狀態回應
 */
interface QRCodePollResponse {
	url: string;
	refresh_token: string;
	timestamp: number;
	status: QRCodeStatus;
	message: string;
	code: number;
}

/**
 * 用戶認證信息
 */
export interface AuthInfo {
	cookies: string;
	refresh_token: string;
	timestamp: number;
}

/**
 * B站 QR Code 登入管理器
 */
export class BilibiliQRLogin {
	private static readonly GENERATE_URL =
		'https://passport.bilibili.com/x/passport-login/web/qrcode/generate';
	private static readonly POLL_URL =
		'https://passport.bilibili.com/x/passport-login/web/qrcode/poll';

	private qrcodeKey: string | null = null;
	private qrcodeUrl: string | null = null;
	private authInfo: AuthInfo | null = null;
	private pollingInterval: NodeJS.Timer | null = null;
	private prevStatus: QRCodeStatus | null = null;

	/**
	 * 生成 QR Code
	 * @returns 返回 QR Code URL 和 key
	 */
	async generateQRCode(): Promise<{ url: string; key: string }> {
		try {
			const response = await fetch(BilibiliQRLogin.GENERATE_URL);
			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);

			const data = await response.json();
			if (data.code !== 0) throw new Error(`API error! ${data.message}`);

			const qrcodeData = data.data as QRCodeGenerateResponse;
			this.qrcodeKey = qrcodeData.qrcode_key;
			this.qrcodeUrl = qrcodeData.url;

			console.log(`QR Code generated: ${this.qrcodeUrl}`);
			return { url: this.qrcodeUrl, key: this.qrcodeKey };
		} catch (error) {
			console.error('Failed to generate QR code:', error);
			throw error;
		}
	}

	/**
	 * 檢查 QR Code 掃描狀態
	 * @returns 返回 QR Code 狀態
	 */
	async checkQRCodeStatus(): Promise<QRCodeStatus> {
		if (!this.qrcodeKey) {
			throw new Error('QR code not generated. Call generateQRCode() first.');
		}

		try {
			const response = await fetch(
				`${BilibiliQRLogin.POLL_URL}?qrcode_key=${this.qrcodeKey}`,
			);
			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);

			const data =
				(await response.json()) as BilibiliResponse<QRCodePollResponse>;
			if (data.code !== 0) throw new Error(`API error! ${data.message}`);
			const code = data.data.code as QRCodeStatus;
			const refresh_token = data.data.refresh_token;
			const cookie = response.headers.get('set-cookie') || '';
			const cookies = cookie.split(';')[0].split('=').slice(1).join('=');
			// 儲存認證信息（如果已確認）
			if (code === QRCodeStatus.CONFIRMED && cookies) {
				this.authInfo = {
					cookies,
					refresh_token,
					timestamp: Date.now(),
				};

				// 儲存 Cookie 到檔案
				this.saveCookies();
			}

			return code;
		} catch (error) {
			console.error('Failed to check QR code status:', error);
			throw error;
		}
	}

	/**
	 * 開始 QR Code 輪詢
	 * @param callback 輪詢回調函數
	 * @param intervalMs 輪詢間隔（毫秒）
	 */
	startPolling(
		callback: (status: QRCodeStatus) => void,
		intervalMs = 3000,
	): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.prevStatus = null;
		}
		this.pollingInterval = setInterval(async () => {
			try {
				const status = await this.checkQRCodeStatus();
				if (this.prevStatus !== status) {
					callback(status);
				}

				// 如果已確認或過期，停止輪詢
				if (
					status === QRCodeStatus.CONFIRMED ||
					status === QRCodeStatus.EXPIRED
				) {
					this.stopPolling();
				}
			} catch (error) {
				console.error('Polling error:', error);
				this.stopPolling();
				callback(QRCodeStatus.EXPIRED);
			}
		}, intervalMs);
	}

	/**
	 * 停止 QR Code 輪詢
	 */
	stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}

	/**
	 * 獲取認證信息
	 * @returns 認證信息
	 */
	getAuthInfo(): AuthInfo | null {
		return this.authInfo;
	}

	/**
	 * 儲存 Cookie 到檔案
	 */
	private saveCookies(): void {
		if (!this.authInfo) return;

		try {
			const cookieFilePath = './cookies/bilibili.json';

			// 確保目錄存在
			const dir = dirname(cookieFilePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			// 使用 Bun.write 寫入檔案
			Bun.write(cookieFilePath, JSON.stringify(this.authInfo, null, 2));

			console.log('Cookies saved to', cookieFilePath);
		} catch (error) {
			console.error('Failed to save cookies:', error);
		}
	}
}

import QRCode from 'qrcode-terminal';

async function main() {
	// 創建 QR 登入管理器
	const qrLogin = new BilibiliQRLogin();

	// 生成 QR Code
	const { url } = await qrLogin.generateQRCode();

	// 在終端顯示 QR Code
	QRCode.generate(url, { small: true }, (qrcode: any) => {
		console.log('請掃描以下 QR Code 進行登入：');
		console.log(qrcode);
	});

	console.log('等待掃描...');

	// 開始輪詢 QR Code 狀態
	qrLogin.startPolling((status) => {
		switch (status) {
			case QRCodeStatus.PENDING:
				console.log('QR Code 等待掃描中...');
				break;
			case QRCodeStatus.SCANNED:
				console.log('QR Code 已掃描，等待確認...');
				break;
			case QRCodeStatus.CONFIRMED:
				console.log('登入成功！');
				const authInfo = qrLogin.getAuthInfo();
				console.log('認證信息:', authInfo);
				break;
			case QRCodeStatus.EXPIRED:
				console.log('QR Code 已過期，請重新生成');
				break;
		}
	}, 500);
}

main();
