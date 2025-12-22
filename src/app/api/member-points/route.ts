import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const membershipId = searchParams.get('membershipId');
  
  if (!slug || !membershipId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // Get penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('id')
    .eq('slug', slug)
    .single();
    
  if (!penca) {
    return NextResponse.json({ error: 'Penca not found' }, { status: 404 });
  }
  
  // Get scores with pagination
  const { data: page1 } = await supabase
    .from('scores')
    .select('points_total')
    .eq('membership_id', membershipId)
    .eq('penca_id', penca.id)
    .range(0, 999);
    
  const { data: page2 } = await supabase
    .from('scores')
    .select('points_total')
    .eq('membership_id', membershipId)
    .eq('penca_id', penca.id)
    .range(1000, 1999);
    
  const scores = [...(page1 || []), ...(page2 || [])];
  const totalPoints = scores.reduce((sum, s) => sum + (s.points_total || 0), 0);
  
  return NextResponse.json({ 
    membershipId,
    scoresCount: scores.length,
    totalPoints 
  });
}
