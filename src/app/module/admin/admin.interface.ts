export interface IChangeUserRoleRequest {
	role: string;
}

export interface IChangeUserRoleParams {
	userId: string;
}

export interface IChangeUserStatusRequest {
	status: string;
}

export interface IChangeUserStatusParams {
	userId: string;
}

export interface IAuditLogsQuery {
	page?: string;
	limit?: string;
	actorId?: string;
	action?: string;
}