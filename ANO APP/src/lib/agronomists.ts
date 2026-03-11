import { agronomistSpecialties, crops, type CropIssue, type CropId } from '../data';
import type { AgronomistDirectoryRecord } from './app-types';

export interface AgronomistMatch extends AgronomistDirectoryRecord {
  matchScore: number;
  matchReason: string;
}

export function getSpecialtyLabel(id: string) {
  return agronomistSpecialties.find((specialty) => specialty.id === id)?.label ?? id;
}

export function getSpecialtySummary(id: string) {
  return agronomistSpecialties.find((specialty) => specialty.id === id)?.summary ?? 'Crop support';
}

export function formatAvailability(status: AgronomistDirectoryRecord['availabilityStatus']) {
  if (status === 'field-visit') {
    return 'On field visit';
  }

  if (status === 'busy') {
    return 'Busy';
  }

  return 'Available';
}

export function getAvailabilityTone(status: AgronomistDirectoryRecord['availabilityStatus']) {
  if (status === 'available') {
    return 'success';
  }

  if (status === 'field-visit') {
    return 'warning';
  }

  return 'neutral';
}

export function buildWhatsappLink(phoneNumber: string, message: string) {
  const digits = phoneNumber.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function matchAgronomists(input: {
  agronomists: AgronomistDirectoryRecord[];
  country: AgronomistDirectoryRecord['country'];
  regionId: string;
  cropId?: CropId;
  issueCategory?: CropIssue['category'] | null;
}) {
  const cropName = crops.find((crop) => crop.id === input.cropId)?.name;

  return input.agronomists
    .map<AgronomistMatch>((agronomist) => {
      let matchScore = agronomist.regionId === input.regionId ? 5 : agronomist.country === input.country ? 1 : 0;
      const reasons: string[] = [];

      if (agronomist.regionId === input.regionId) {
        reasons.push('same region');
      }

      agronomist.specializationIds.forEach((specialtyId) => {
        const specialty = agronomistSpecialties.find((entry) => entry.id === specialtyId);
        if (!specialty) {
          return;
        }

        if (input.cropId && specialty.cropIds?.includes(input.cropId)) {
          matchScore += 3;
          if (cropName) {
            reasons.push(`${cropName.toLowerCase()} support`);
          }
        }

        if (input.issueCategory && specialty.issueCategories?.includes(input.issueCategory)) {
          matchScore += 2;
          reasons.push(`${input.issueCategory} response`);
        }
      });

      if (agronomist.availabilityStatus === 'available') {
        matchScore += 2;
      } else if (agronomist.availabilityStatus === 'field-visit') {
        matchScore += 1;
      }

      return {
        ...agronomist,
        matchScore,
        matchReason: reasons[0] ?? 'general crop support',
      };
    })
    .sort((left, right) => right.matchScore - left.matchScore || left.fullName.localeCompare(right.fullName));
}
