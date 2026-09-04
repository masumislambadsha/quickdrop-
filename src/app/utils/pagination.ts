import { Prisma } from "../../generated/prisma/client.js";

function buildWhere(options: {
	search?: string;
	searchFields?: string[];
	status?: string;
	exact?: Record<string, unknown>;
	extra?: Record<string, unknown>;
}): Prisma.ShipmentWhereInput {
	const { search, searchFields = [], status, exact = {}, extra = {} } = options;

	const where: Prisma.ShipmentWhereInput = {
		isDeleted: false,
		...extra,
	};

	if (status && searchFields.length > 0) {
		where.status = status as Prisma.EnumShipmentStatusFilter;
	}

	if (search && searchFields.length > 0) {
		where.OR = searchFields.map((field) => ({
			[field]: { contains: search, mode: "insensitive" },
		}));
	}

	Object.assign(where, exact);

	return where;
}

interface PaginationResult {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

function calculatePagination(total: number, page: number, limit: number): PaginationResult {
	const totalPages = Math.ceil(total / limit);
	return {
		page,
		limit,
		total,
		totalPages,
		hasNextPage: page < totalPages,
		hasPrevPage: page > 1,
	};
}

function parsePageParams(pageStr?: string, limitStr?: string): { page: number; limit: number; skip: number } {
	const page = Math.max(1, Number(pageStr) || 1);
	const limit = Math.min(100, Math.max(1, Number(limitStr) || 10));
	return { page, limit, skip: (page - 1) * limit };
}

export { buildWhere, calculatePagination, parsePageParams };
