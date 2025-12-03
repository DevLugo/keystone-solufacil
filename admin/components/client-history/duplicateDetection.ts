// Duplicate detection utilities for client search
// Levenshtein distance algorithm and duplicate finder copied from admin/pages/historial-cliente.tsx

import { ClientSearchResult, DuplicatePair } from './types';

/**
 * Calculate Levenshtein distance between two strings
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Edit distance (number of insertions, deletions, substitutions)
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len2][len1];
};

/**
 * Find potential duplicate clients based on name similarity
 * @param clients - Array of client search results
 * @returns Array of duplicate pairs with similarity percentage
 */
export const findPotentialDuplicates = (clients: ClientSearchResult[]): DuplicatePair[] => {
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const client1 = clients[i];
      const client2 = clients[j];

      // Normalize names (remove accents, convert to uppercase)
      const name1 = client1.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      const name2 = client2.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

      // Calculate Levenshtein distance
      const distance = levenshteinDistance(name1, name2);
      const maxLength = Math.max(name1.length, name2.length);
      const similarity = ((maxLength - distance) / maxLength) * 100;

      // Consider duplicate if similarity >= 85% (max 2-3 differences in short names)
      if (similarity >= 85 && distance <= 3) {
        duplicates.push({
          client1,
          client2,
          similarity: Math.round(similarity)
        });
      }
    }
  }

  // Sort by similarity descending
  return duplicates.sort((a, b) => b.similarity - a.similarity);
};
