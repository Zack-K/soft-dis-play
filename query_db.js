const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueChunks] = line.split('=');
  if (key && valueChunks.length > 0) {
    env[key.trim()] = valueChunks.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data: rooms } = await supabase.from('rooms').select('*').order('created_at', { ascending: false }).limit(1);
  console.log('Room:', rooms[0].id, 'Host:', rooms[0].host_id);
  const { data: gameStates } = await supabase.from('game_states').select('*').eq('room_id', rooms[0].id);
  console.log('GameState:', gameStates[0]);
  const { data: players } = await supabase.from('players').select('*').eq('room_id', rooms[0].id);
  console.log('Players:', players.map(p => ({ id: p.id, name: p.name })));
}
run();
