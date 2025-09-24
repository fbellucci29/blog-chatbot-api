import { createClient } from '@supabase/supabase-js';

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Mancano le variabili d\'ambiente Supabase');
}

// Client Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);

// Funzione per controllare i limiti delle richieste
export async function checkUserLimits(userIdentifier, limitType = 'daily') {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Controlla richieste esistenti oggi
    const { data, error } = await supabase
      .from('user_requests')
      .select('count')
      .eq('user_identifier', userIdentifier)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    const currentCount = data ? data.count : 0;
    const dailyLimit = 10; // Limite di richieste al giorno

    return {
      allowed: currentCount < dailyLimit,
      remaining: Math.max(0, dailyLimit - currentCount),
      currentCount,
      limit: dailyLimit
    };
  } catch (error) {
    console.error('Errore controllo limiti:', error);
    return { allowed: false, error: error.message };
  }
}

// Funzione per incrementare il contatore richieste
export async function incrementUserRequests(userIdentifier) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Prova a incrementare se esiste, altrimenti crea nuovo record
    const { data, error } = await supabase
      .from('user_requests')
      .upsert({
        user_identifier: userIdentifier,
        date: today,
        count: 1
      }, {
        onConflict: 'user_identifier,date',
        ignoreDuplicates: false
      });

    if (error) {
      // Se upsert non funziona, proviamo con update o insert separati
      const { data: existing } = await supabase
        .from('user_requests')
        .select('count')
        .eq('user_identifier', userIdentifier)
        .eq('date', today)
        .single();

      if (existing) {
        // Record exists, increment
        const { error: updateError } = await supabase
          .from('user_requests')
          .update({ count: existing.count + 1 })
          .eq('user_identifier', userIdentifier)
          .eq('date', today);
        
        if (updateError) throw updateError;
      } else {
        // Record doesn't exist, create
        const { error: insertError } = await supabase
          .from('user_requests')
          .insert({
            user_identifier: userIdentifier,
            date: today,
            count: 1
          });
        
        if (insertError) throw insertError;
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Errore incremento richieste:', error);
    return { success: false, error: error.message };
  }
}

// Funzione per ottenere dati del corso
export async function getCourseContent(courseId, moduleId) {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('content, title, description')
      .eq('course_id', courseId)
      .eq('module_id', moduleId)
      .single();

    if (error) throw error;

    return {
      success: true,
      content: data.content,
      title: data.title,
      description: data.description
    };
  } catch (error) {
    console.error('Errore recupero contenuti corso:', error);
    return { success: false, error: error.message };
  }
}
