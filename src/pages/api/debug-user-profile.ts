export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export const GET: APIRoute = async ({ url }) => {
  try {
    const userId = url.searchParams.get('id');

    console.log('📝 DEBUG: Obteniendo datos del usuario:', userId);

    if (!userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ID de usuario no proporcionado' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener TODOS los campos sin especificar para ver la estructura
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId);

    if (error) {
      console.error('❌ Error de Supabase:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || 'Error al obtener el usuario' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Datos obtenidos:', data);
    
    if (!data || data.length === 0) {
      console.log('⚠️ No hay datos');
      return new Response(JSON.stringify({
        success: false,
        error: 'Usuario no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: data[0],
      allFields: Object.keys(data[0])
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('❌ Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
