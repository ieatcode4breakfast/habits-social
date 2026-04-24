import type { IHabit } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB();
  const userId = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  const habit = await db.collection<IHabit>('habits').findOne({ _id: new ObjectId(id), ownerid: userId });
  if (!habit) throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (event.method === 'PUT') {
    const body = await readBody(event);
    
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.frequencyCount !== undefined) updateData.frequencyCount = body.frequencyCount;
    if (body.frequencyPeriod !== undefined) updateData.frequencyPeriod = body.frequencyPeriod;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.sharedwith && Array.isArray(body.sharedwith)) updateData.sharedwith = body.sharedwith;
    updateData.updatedat = new Date();

    const result = await db.collection<IHabit>('habits').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) throw createError({ statusCode: 404, statusMessage: 'Not found after update' });

    return { 
      ...result,
      id: result._id!.toString()
    };
  }

  if (event.method === 'DELETE') {
    await db.collection<IHabit>('habits').deleteOne({ _id: new ObjectId(id) });
    return { success: true };
  }
});
