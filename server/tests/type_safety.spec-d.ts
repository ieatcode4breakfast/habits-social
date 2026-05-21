import { describe, test, expectTypeOf } from 'vitest';
import { useDB } from '../utils/db';
import { SyncService } from '../services/sync.service';
import { HabitService } from '../services/habit.service';
import { BucketService } from '../services/bucket.service';
import { ChatService } from '../services/chat.service';
import { UserService } from '../services/user.service';

describe('Database Type Safety and Philosophy Guard', () => {
  test('useDB utility return type must NOT fallback to any', () => {
    expectTypeOf(useDB).returns.not.toBeAny();
  });

  test('SyncService database parameters must reject any', () => {
    expectTypeOf(SyncService.getDeltas).parameter(0).not.toBeAny();
    expectTypeOf(SyncService.getPaginatedDeltas).parameter(0).not.toBeAny();
  });

  test('HabitService database parameters must reject any', () => {
    expectTypeOf(HabitService.createHabit).parameter(0).not.toBeAny();
    expectTypeOf(HabitService.logHabit).parameter(0).not.toBeAny();
  });

  test('BucketService database parameters must reject any', () => {
    expectTypeOf(BucketService.logBucket).parameter(0).not.toBeAny();
  });

  test('UserService database parameters must reject any', () => {
    expectTypeOf(UserService.deleteUser).parameter(0).not.toBeAny();
  });

  test('ChatService boundaries must reject any', () => {
    expectTypeOf(ChatService.sendMessage).parameter(0).not.toBeAny();
    expectTypeOf(ChatService.listConversations).parameter(0).not.toBeAny();
    expectTypeOf(ChatService.listMessages).parameter(0).not.toBeAny();
    expectTypeOf(ChatService.verifyAccess).parameter(0).not.toBeAny();
    
    // Check complex return types
    expectTypeOf(ChatService.listConversations).returns.not.toBeAny();
    expectTypeOf(ChatService.listMessages).returns.not.toBeAny();
  });
});
