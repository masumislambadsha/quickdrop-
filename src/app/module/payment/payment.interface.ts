export interface IInitiatePaymentRequest {
	shipmentId: string;
	origin: string;
	dest: string;
}

export interface IPaymentQuery {
	page?: string;
	limit?: string;
	status?: string;
}