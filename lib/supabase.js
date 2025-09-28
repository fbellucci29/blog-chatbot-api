import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Controlla se utente ha già fatto prima domanda
export async function checkFirstQuestion(sessionId) {
  const { data } = await supabase
    .from('anonymous_sessions')
    .select('first_question_asked')
    .eq('session_id', sessionId)
    .single();
  
  return data?.first_question_asked || false;
}

// Salva prima domanda anonima
export async function saveFirstQuestion(sessionId, question) {
  await supabase
    .from('anonymous_sessions')
    .upsert({
      session_id: sessionId,
      first_question_asked: true,
      created_at: new Date().toISOString()
    });
  
  await supabase
    .from('user_requests')
    .insert({
      user_identifier: sessionId,
      session_id: sessionId,
      question: question,
      user_type: 'anonymous',
      is_first_question: true
    });
}

// Controlla limiti utente registrato
export async function checkUserLimits(email) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('daily_limits')
    .select('question_count')
    .eq('user_identifier', email)
    .eq('date', today)
    .single();
  
  const count = data?.question_count || 0;
  return {
    allowed: count < 5,
    remaining: 5 - count,
    current: count
  };
}

// Incrementa contatore utente registrato
export async function incrementUserCount(email, question) {
  const today = new Date().toISOString().split('T')[0];
  
  await supabase
    .from('daily_limits')
    .upsert({
      user_identifier: email,
      date: today,
      question_count: 1,
      user_type: 'registered'
    }, {
      onConflict: 'user_identifier,date',
      ignoreDuplicates: false
    });
  
  await supabase
    .from('user_requests')
    .insert({
      user_identifier: email,
      question: question,
      user_type: 'registered'
    });
}

// Registra nuovo utente
export async function registerUser(name, email) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: name,
      email: email,
      registration_date: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
