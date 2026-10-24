// supabase/functions/send-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  try {
    const { 
      pushToken, 
      title, 
      body, 
      data = {}, 
      channelId = 'default',
      priority = 'high'
    } = await req.json();

    // Validation
    if (!pushToken) {
      return new Response(
        JSON.stringify({ error: 'pushToken is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      priority: priority,
      channelId: channelId,
      data: data || {},
    };

    console.log(`[Push] Sending to ${pushToken.substring(0, 25)}... | Title: "${title}"`);

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    console.log('[Push] Expo Response:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Push notification sent successfully',
        expoResult: result 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[Push] Error:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send push notification', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});