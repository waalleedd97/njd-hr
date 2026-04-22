export interface UserProfile {
  id: string;
  localId: string;
  nameAr: string;
  nameEn: string;
  positionAr: string;
  positionEn: string;
  initials: string;
  email: string;
  profileCompleted?: boolean;
}
