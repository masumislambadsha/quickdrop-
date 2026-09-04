export interface IRegisterRequest {
	name: string;
	email: string;
	password: string;
}

export interface ILoginRequest {
	email: string;
	password: string;
}

export interface IGoogleLoginRequest {
	code?: string;
	idToken?: string;
	redirectUri?: string;
}

export interface IRefreshRequest {
	refreshToken: string;
}

export interface IChangePasswordRequest {
	oldPassword: string;
	newPassword: string;
}

export interface IAuthResponse {
	accessToken: string;
	refreshToken: string;
}

export interface IAuthUserResponse {
	id: string;
	name: string;
	email: string;
	role: string;
	status: string;
	needPasswordChange: boolean;
}