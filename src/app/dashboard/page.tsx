import { createClient } from '@/utils/supabase/server'

export default async function Dashboard() {
  const supabase = createClient()

  const { data, error } = await supabase.from("twitch_integration").select("access_token").eq("user_id", "69a8df48-ff0a-4f7f-b126-8c4ddc6c0edb").eq("channel_id", 122604941).single()

  if (error) {
    console.log(error);
  }

  if (data) {
    return <div className='flex justify-center items-center'>test {JSON.stringify(data)}</div>
  }

  

  return <p>{}</p>
}