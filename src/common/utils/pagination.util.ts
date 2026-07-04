import { PaginatedResponse } from '../interfaces/api-response.interface';

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    success: true,
    message: 'Data entries retrieved successfully',
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    timestamp: new Date().toISOString(),
  };
}