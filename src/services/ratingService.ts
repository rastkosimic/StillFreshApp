import { API_ROUTES } from '@/config/api';
import apiClient from '@/services/apiClient';
import {
  ApiError,
  RatingRequest,
  RatingResponse,
  SuccessResponse,
  VendorRatingSummary,
} from '@/types';

const EMPTY_SUMMARY = (vendorId: number): VendorRatingSummary => ({
  vendorId,
  averageRating: 0,
  totalRatings: 0,
  averageCollectionProcessRating: 0,
  averageQualityRating: 0,
  averageQuantityRating: 0,
  averageVarietyRating: 0,
});

function toApiError(err: unknown): ApiError {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return err as ApiError;
  }
  return { message: 'An unexpected error occurred' };
}

export async function submitRating(request: RatingRequest): Promise<RatingResponse> {
  try {
    const response = await apiClient.post<RatingResponse>(
      API_ROUTES.vendors.ratings.submit,
      request,
    );
    return response.data;
  } catch (err) {
    const apiErr = toApiError(err);
    if (apiErr.status === 401) {
      throw new Error('Please log in to submit a rating.');
    }
    if (apiErr.status === 400) {
      throw new Error(
        apiErr.message || 'Invalid rating values. All ratings must be between 1 and 5 stars.',
      );
    }
    if (apiErr.status === 403) {
      throw new Error('You do not have permission to rate this order.');
    }
    if (apiErr.status === 404) {
      throw new Error(apiErr.message || 'Order or vendor not found.');
    }
    throw new Error('Failed to submit rating. Please try again.');
  }
}

export async function getRatingsByVendor(vendorId: number): Promise<RatingResponse[]> {
  try {
    const response = await apiClient.get<RatingResponse[]>(
      API_ROUTES.vendors.ratings.getByVendor(vendorId),
    );
    return response.data;
  } catch (err) {
    const apiErr = toApiError(err);
    if (apiErr.status === 401) {
      throw new Error('Please log in to view ratings.');
    }
    throw new Error('Failed to fetch ratings.');
  }
}

export async function getMyRatings(): Promise<RatingResponse[]> {
  try {
    const response = await apiClient.get<RatingResponse[]>(
      API_ROUTES.vendors.ratings.getMyRatings,
    );
    return response.data;
  } catch (err) {
    const apiErr = toApiError(err);
    if (apiErr.status === 401) {
      throw new Error('Please log in to view your ratings.');
    }
    throw new Error('Failed to fetch your ratings.');
  }
}

export async function getMyRatingForOrder(orderId: number): Promise<RatingResponse | null> {
  const ratings = await getMyRatings();
  return ratings.find((rating) => rating.orderId === orderId) ?? null;
}

export async function getVendorRatingSummary(
  vendorId: number | string,
): Promise<VendorRatingSummary> {
  try {
    const response = await apiClient.get<VendorRatingSummary>(
      API_ROUTES.vendors.ratings.getSummary(vendorId),
    );
    return response.data;
  } catch (err) {
    const apiErr = toApiError(err);
    if (apiErr.status === 401) {
      throw new Error('Please log in to view rating summary.');
    }
    return EMPTY_SUMMARY(Number(vendorId));
  }
}

export async function hasOrderBeenRated(orderId: number | string): Promise<boolean> {
  try {
    const response = await apiClient.get<SuccessResponse>(
      API_ROUTES.vendors.ratings.hasRated(orderId),
    );
    return response.data.message.includes('true');
  } catch (err) {
    const apiErr = toApiError(err);
    if (apiErr.status === 401) {
      throw new Error('Please log in to check rating status.');
    }
    return false;
  }
}
