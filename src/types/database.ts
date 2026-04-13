export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          bio: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          username?: string
          avatar_url?: string | null
          bio?: string | null
        }
      }
      gallery_posts: {
        Row: {
          id: string
          user_id: string
          image_url: string
          title: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_url: string
          title: string
          description?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
        }
      }
      community_posts: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          created_at?: string
        }
        Update: {
          title?: string
          content?: string
        }
      }
      likes: {
        Row: {
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
        }
        Insert: {
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
        }
        Update: never
      }
      comments: {
        Row: {
          id: string
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
      }
    }
    Views: {
      gallery_feed: {
        Row: {
          id: string
          user_id: string
          image_url: string
          title: string
          description: string | null
          created_at: string
          username: string
          avatar_url: string | null
          likes_count: number
          comments_count: number
        }
      }
      community_feed: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          created_at: string
          username: string
          comments_count: number
        }
      }
    }
  }
}
