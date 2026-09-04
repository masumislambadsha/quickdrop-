export interface IAssignCourierRequest {
	courierId: string;
}

export interface IUpdateDeliveryStatusRequest {
	status: string;
	failedReason?: string;
}

export interface IUpdateDeliveryStatusParams {
	id: string;
}

export interface IMyDeliveriesQuery {
	page?: string;
	limit?: string;
	status?: string;
}