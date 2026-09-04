export interface IUpdateMeRequest {
	name?: string;
	contactNumber?: string;
	address?: string;
	city?: string;
}

export interface IGetUsersFaqQuery {
	page?: number;
	limit?: number;
	search?: string;
	role?: string;
}