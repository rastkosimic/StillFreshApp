export interface RatingRequest {
  vendorId: number;
  collectionProcessRating: number;
  qualityRating: number;
  quantityRating: number;
  varietyRating: number;
  orderId: number;
}

export interface RatingResponse {
  id: number;
  vendorId: number;
  userId: number;
  orderId: number;
  collectionProcessRating: number;
  qualityRating: number;
  quantityRating: number;
  varietyRating: number;
  totalRating: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface VendorRatingSummary {
  vendorId: number;
  averageRating: number;
  totalRatings: number;
  averageCollectionProcessRating: number;
  averageQualityRating: number;
  averageQuantityRating: number;
  averageVarietyRating: number;
  ratingBreakdown?: Record<string, number>;
}
