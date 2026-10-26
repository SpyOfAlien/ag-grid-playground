import { Injectable, signal } from '@angular/core';

export const LAB_USERS = ['anna', 'ben'] as const;
export type LabUserId = (typeof LAB_USERS)[number];

/** Who is signed in to the lab; layouts are saved per user. */
@Injectable({ providedIn: 'root' })
export class LabUser {
  readonly id = signal<LabUserId>('anna');
}
