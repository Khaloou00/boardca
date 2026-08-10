export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_commentaires: {
        Row: {
          action_id: string
          auteur_id: string
          created_at: string
          id: string
          texte: string
        }
        Insert: {
          action_id: string
          auteur_id: string
          created_at?: string
          id?: string
          texte: string
        }
        Update: {
          action_id?: string
          auteur_id?: string
          created_at?: string
          id?: string
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_commentaires_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_commentaires_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_commentaires_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      action_rapports: {
        Row: {
          action_id: string
          auteur_id: string
          avancement: number
          created_at: string
          fichier_nom: string | null
          fichier_path: string | null
          fichier_taille: number | null
          fichier_type: string | null
          id: string
          texte: string
        }
        Insert: {
          action_id: string
          auteur_id: string
          avancement: number
          created_at?: string
          fichier_nom?: string | null
          fichier_path?: string | null
          fichier_taille?: number | null
          fichier_type?: string | null
          id?: string
          texte: string
        }
        Update: {
          action_id?: string
          auteur_id?: string
          avancement?: number
          created_at?: string
          fichier_nom?: string | null
          fichier_path?: string | null
          fichier_taille?: number | null
          fichier_type?: string | null
          id?: string
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_rapports_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_rapports_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_rapports_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      actions: {
        Row: {
          assigne_par: string | null
          avancement: number
          created_at: string
          description: string | null
          echeance: string | null
          id: string
          priorite: string | null
          resolution_id: string | null
          responsable_id: string
          reunion_id: string | null
          statut: string
          titre: string
        }
        Insert: {
          assigne_par?: string | null
          avancement?: number
          created_at?: string
          description?: string | null
          echeance?: string | null
          id?: string
          priorite?: string | null
          resolution_id?: string | null
          responsable_id: string
          reunion_id?: string | null
          statut?: string
          titre: string
        }
        Update: {
          assigne_par?: string | null
          avancement?: number
          created_at?: string
          description?: string | null
          echeance?: string | null
          id?: string
          priorite?: string | null
          resolution_id?: string | null
          responsable_id?: string
          reunion_id?: string | null
          statut?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_assigne_par_fkey"
            columns: ["assigne_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_assigne_par_fkey"
            columns: ["assigne_par"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "actions_resolution_id_fkey"
            columns: ["resolution_id"]
            isOneToOne: false
            referencedRelation: "resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "actions_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          board_book_id: string | null
          created_at: string
          debut: number
          document_id: string | null
          id: string
          longueur: number
          note: string | null
          page: number
          partage_avec_user_id: string | null
          pv_id: string | null
          pv_version: number | null
          texte: string
          type: string
          user_id: string
          visibility: string
        }
        Insert: {
          board_book_id?: string | null
          created_at?: string
          debut: number
          document_id?: string | null
          id?: string
          longueur: number
          note?: string | null
          page: number
          partage_avec_user_id?: string | null
          pv_id?: string | null
          pv_version?: number | null
          texte: string
          type: string
          user_id: string
          visibility: string
        }
        Update: {
          board_book_id?: string | null
          created_at?: string
          debut?: number
          document_id?: string | null
          id?: string
          longueur?: number
          note?: string | null
          page?: number
          partage_avec_user_id?: string | null
          pv_id?: string | null
          pv_version?: number | null
          texte?: string
          type?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_board_book_id_fkey"
            columns: ["board_book_id"]
            isOneToOne: false
            referencedRelation: "board_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_partage_avec_user_id_fkey"
            columns: ["partage_avec_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_partage_avec_user_id_fkey"
            columns: ["partage_avec_user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "annotations_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          hash_sha256: string | null
          id: number
          ip: unknown
          ressource: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          hash_sha256?: string | null
          id?: never
          ip?: unknown
          ressource?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          hash_sha256?: string | null
          id?: never
          ip?: unknown
          ressource?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      baremes_jetons: {
        Row: {
          mode: string
          montant: number
          type_reunion: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          mode: string
          montant?: number
          type_reunion?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          mode?: string
          montant?: number
          type_reunion?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "baremes_jetons_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baremes_jetons_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      board_books: {
        Row: {
          genere_at: string | null
          genere_par: string | null
          hash_sha256: string | null
          id: string
          pages: number | null
          reunion_id: string
          storage_path: string | null
          taille_bytes: number | null
        }
        Insert: {
          genere_at?: string | null
          genere_par?: string | null
          hash_sha256?: string | null
          id?: string
          pages?: number | null
          reunion_id: string
          storage_path?: string | null
          taille_bytes?: number | null
        }
        Update: {
          genere_at?: string | null
          genere_par?: string | null
          hash_sha256?: string | null
          id?: string
          pages?: number | null
          reunion_id?: string
          storage_path?: string | null
          taille_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "board_books_genere_par_fkey"
            columns: ["genere_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_books_genere_par_fkey"
            columns: ["genere_par"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "board_books_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: true
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletins: {
        Row: {
          choix: string
          id: string
          user_id: string
          vote_id: string
          voted_at: string | null
        }
        Insert: {
          choix: string
          id?: string
          user_id: string
          vote_id: string
          voted_at?: string | null
        }
        Update: {
          choix?: string
          id?: string
          user_id?: string
          vote_id?: string
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulletins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bulletins_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      comite_membres: {
        Row: {
          comite_id: string
          user_id: string
        }
        Insert: {
          comite_id: string
          user_id: string
        }
        Update: {
          comite_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comite_membres_comite_id_fkey"
            columns: ["comite_id"]
            isOneToOne: false
            referencedRelation: "comites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comite_membres_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comite_membres_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      comites: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
          president_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          president_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          president_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comites_president_id_fkey"
            columns: ["president_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comites_president_id_fkey"
            columns: ["president_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      consultation_reponses: {
        Row: {
          choix: string
          consultation_id: string
          created_at: string
          id: string
          motivation: string | null
          user_id: string
        }
        Insert: {
          choix: string
          consultation_id: string
          created_at?: string
          id?: string
          motivation?: string | null
          user_id: string
        }
        Update: {
          choix?: string
          consultation_id?: string
          created_at?: string
          id?: string
          motivation?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_reponses_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_reponses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_reponses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      consultations: {
        Row: {
          closed_at: string | null
          contexte: string | null
          created_at: string
          deadline: string
          id: string
          ouverte_par: string | null
          question: string
          resultat: string | null
          statut: string
        }
        Insert: {
          closed_at?: string | null
          contexte?: string | null
          created_at?: string
          deadline: string
          id?: string
          ouverte_par?: string | null
          question: string
          resultat?: string | null
          statut?: string
        }
        Update: {
          closed_at?: string | null
          contexte?: string | null
          created_at?: string
          deadline?: string
          id?: string
          ouverte_par?: string | null
          question?: string
          resultat?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_ouverte_par_fkey"
            columns: ["ouverte_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_ouverte_par_fkey"
            columns: ["ouverte_par"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      convocations: {
        Row: {
          id: string
          opened_at: string | null
          reunion_id: string
          sent_at: string | null
          statut: string
          user_id: string
        }
        Insert: {
          id?: string
          opened_at?: string | null
          reunion_id: string
          sent_at?: string | null
          statut?: string
          user_id: string
        }
        Update: {
          id?: string
          opened_at?: string | null
          reunion_id?: string
          sent_at?: string | null
          statut?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convocations_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      demandes_invite: {
        Row: {
          created_at: string
          de_user_id: string
          decided_at: string | null
          decided_by: string | null
          email: string
          id: string
          motif: string | null
          nom: string
          prenom: string
          reunion_id: string
          statut: string
          vers_user_id: string | null
        }
        Insert: {
          created_at?: string
          de_user_id: string
          decided_at?: string | null
          decided_by?: string | null
          email: string
          id?: string
          motif?: string | null
          nom: string
          prenom: string
          reunion_id: string
          statut?: string
          vers_user_id?: string | null
        }
        Update: {
          created_at?: string
          de_user_id?: string
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          id?: string
          motif?: string | null
          nom?: string
          prenom?: string
          reunion_id?: string
          statut?: string
          vers_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_invite_de_user_id_fkey"
            columns: ["de_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_invite_de_user_id_fkey"
            columns: ["de_user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "demandes_invite_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_invite_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "demandes_invite_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_invite_vers_user_id_fkey"
            columns: ["vers_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_invite_vers_user_id_fkey"
            columns: ["vers_user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      discussion_messages: {
        Row: {
          auteur_id: string
          contenu: string
          created_at: string
          deleted_at: string | null
          discussion_id: string
          edited_at: string | null
          epingle_at: string | null
          epingle_par: string | null
          fichier_nom: string | null
          fichier_path: string | null
          fichier_taille: number | null
          fichier_type: string | null
          id: string
        }
        Insert: {
          auteur_id: string
          contenu: string
          created_at?: string
          deleted_at?: string | null
          discussion_id: string
          edited_at?: string | null
          epingle_at?: string | null
          epingle_par?: string | null
          fichier_nom?: string | null
          fichier_path?: string | null
          fichier_taille?: number | null
          fichier_type?: string | null
          id?: string
        }
        Update: {
          auteur_id?: string
          contenu?: string
          created_at?: string
          deleted_at?: string | null
          discussion_id?: string
          edited_at?: string | null
          epingle_at?: string | null
          epingle_par?: string | null
          fichier_nom?: string | null
          fichier_path?: string | null
          fichier_taille?: number | null
          fichier_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_messages_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_messages_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "discussion_messages_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_messages_epingle_par_fkey"
            columns: ["epingle_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_messages_epingle_par_fkey"
            columns: ["epingle_par"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      discussions: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          secretaire_visible: boolean
          statut: string
          titre: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          secretaire_visible?: boolean
          statut?: string
          titre: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          secretaire_visible?: boolean
          statut?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      documents: {
        Row: {
          contenu: string | null
          created_at: string
          id: string
          nom: string
          pages: number | null
          point_oj_id: string | null
          reunion_id: string
          storage_path: string | null
          taille_bytes: number | null
          type: string
          uploaded_by: string | null
        }
        Insert: {
          contenu?: string | null
          created_at?: string
          id?: string
          nom: string
          pages?: number | null
          point_oj_id?: string | null
          reunion_id: string
          storage_path?: string | null
          taille_bytes?: number | null
          type: string
          uploaded_by?: string | null
        }
        Update: {
          contenu?: string | null
          created_at?: string
          id?: string
          nom?: string
          pages?: number | null
          point_oj_id?: string | null
          reunion_id?: string
          storage_path?: string | null
          taille_bytes?: number | null
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_point_oj_id_fkey"
            columns: ["point_oj_id"]
            isOneToOne: false
            referencedRelation: "ordre_du_jour"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      jetons_presence: {
        Row: {
          created_at: string
          id: string
          mode: string
          montant: number
          paye: boolean
          paye_at: string | null
          paye_par: string | null
          reunion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode: string
          montant?: number
          paye?: boolean
          paye_at?: string | null
          paye_par?: string | null
          reunion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          montant?: number
          paye?: boolean
          paye_at?: string | null
          paye_par?: string | null
          reunion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jetons_presence_paye_par_fkey"
            columns: ["paye_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jetons_presence_paye_par_fkey"
            columns: ["paye_par"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "jetons_presence_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jetons_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jetons_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lu: boolean
          message: string | null
          ressource_id: string | null
          ressource_type: string | null
          titre: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lu?: boolean
          message?: string | null
          ressource_id?: string | null
          ressource_type?: string | null
          titre: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lu?: boolean
          message?: string | null
          ressource_id?: string | null
          ressource_type?: string | null
          titre?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ordre_du_jour: {
        Row: {
          duree_min: number | null
          id: string
          obligatoire: boolean
          position: number
          reunion_id: string
          titre: string
        }
        Insert: {
          duree_min?: number | null
          id?: string
          obligatoire?: boolean
          position: number
          reunion_id: string
          titre: string
        }
        Update: {
          duree_min?: number | null
          id?: string
          obligatoire?: boolean
          position?: number
          reunion_id?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordre_du_jour_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
        ]
      }
      presences: {
        Row: {
          id: string
          mode: string
          reunion_id: string
          scanned_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          mode: string
          reunion_id: string
          scanned_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          mode?: string
          reunion_id?: string
          scanned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presences_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      procurations: {
        Row: {
          created_at: string
          de_user_id: string
          id: string
          reunion_id: string
          revoked_at: string | null
          statut: string
          vers_user_id: string
        }
        Insert: {
          created_at?: string
          de_user_id: string
          id?: string
          reunion_id: string
          revoked_at?: string | null
          statut?: string
          vers_user_id: string
        }
        Update: {
          created_at?: string
          de_user_id?: string
          id?: string
          reunion_id?: string
          revoked_at?: string | null
          statut?: string
          vers_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurations_de_user_id_fkey"
            columns: ["de_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurations_de_user_id_fkey"
            columns: ["de_user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "procurations_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurations_vers_user_id_fkey"
            columns: ["vers_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurations_vers_user_id_fkey"
            columns: ["vers_user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_initiales: string | null
          created_at: string
          derniere_connexion: string | null
          email: string
          est_president_ca: boolean
          id: string
          must_change_password: boolean
          nom: string
          qualite: string | null
          role: Database["public"]["Enums"]["user_role"]
          statut: string
          telephone: string | null
        }
        Insert: {
          avatar_initiales?: string | null
          created_at?: string
          derniere_connexion?: string | null
          email: string
          est_president_ca?: boolean
          id: string
          must_change_password?: boolean
          nom: string
          qualite?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          statut?: string
          telephone?: string | null
        }
        Update: {
          avatar_initiales?: string | null
          created_at?: string
          derniere_connexion?: string | null
          email?: string
          est_president_ca?: boolean
          id?: string
          must_change_password?: boolean
          nom?: string
          qualite?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          statut?: string
          telephone?: string | null
        }
        Relationships: []
      }
      pv: {
        Row: {
          archive_at: string | null
          contenu: string | null
          hash_document: string | null
          id: string
          reunion_id: string
          statut: string
          version: number
        }
        Insert: {
          archive_at?: string | null
          contenu?: string | null
          hash_document?: string | null
          id?: string
          reunion_id: string
          statut?: string
          version?: number
        }
        Update: {
          archive_at?: string | null
          contenu?: string | null
          hash_document?: string | null
          id?: string
          reunion_id?: string
          statut?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pv_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: true
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_observations: {
        Row: {
          created_at: string
          id: string
          pv_id: string
          pv_version: number
          texte: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pv_id: string
          pv_version?: number
          texte: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pv_id?: string
          pv_version?: number
          texte?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_observations_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reports_seance: {
        Row: {
          ancien_lieu: string | null
          ancienne_date: string
          ancienne_heure: string | null
          created_at: string
          emargement: Json
          id: string
          motif: string | null
          nouveau_lieu: string | null
          nouvelle_date: string
          nouvelle_heure: string | null
          presents_constates: number
          quorum_requis: number
          reporte_par: string | null
          reunion_id: string
        }
        Insert: {
          ancien_lieu?: string | null
          ancienne_date: string
          ancienne_heure?: string | null
          created_at?: string
          emargement?: Json
          id?: string
          motif?: string | null
          nouveau_lieu?: string | null
          nouvelle_date: string
          nouvelle_heure?: string | null
          presents_constates: number
          quorum_requis: number
          reporte_par?: string | null
          reunion_id: string
        }
        Update: {
          ancien_lieu?: string | null
          ancienne_date?: string
          ancienne_heure?: string | null
          created_at?: string
          emargement?: Json
          id?: string
          motif?: string | null
          nouveau_lieu?: string | null
          nouvelle_date?: string
          nouvelle_heure?: string | null
          presents_constates?: number
          quorum_requis?: number
          reporte_par?: string | null
          reunion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_seance_reporte_par_fkey"
            columns: ["reporte_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_seance_reporte_par_fkey"
            columns: ["reporte_par"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reports_seance_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
        ]
      }
      resolutions: {
        Row: {
          code: string
          id: string
          resultat: string | null
          reunion_id: string
          texte: string
          vote_id: string | null
        }
        Insert: {
          code: string
          id?: string
          resultat?: string | null
          reunion_id: string
          texte: string
          vote_id?: string | null
        }
        Update: {
          code?: string
          id?: string
          resultat?: string | null
          reunion_id?: string
          texte?: string
          vote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resolutions_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolutions_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      reunions: {
        Row: {
          cloturee_at: string | null
          comite_id: string | null
          created_at: string
          created_by: string | null
          date_reunion: string
          duree_min: number | null
          heure: string | null
          id: string
          lien_visio: string | null
          lieu: string | null
          president_seance_id: string | null
          quorum_requis: number
          statut: string
          titre: string
          type: string
        }
        Insert: {
          cloturee_at?: string | null
          comite_id?: string | null
          created_at?: string
          created_by?: string | null
          date_reunion: string
          duree_min?: number | null
          heure?: string | null
          id?: string
          lien_visio?: string | null
          lieu?: string | null
          president_seance_id?: string | null
          quorum_requis?: number
          statut?: string
          titre: string
          type: string
        }
        Update: {
          cloturee_at?: string | null
          comite_id?: string | null
          created_at?: string
          created_by?: string | null
          date_reunion?: string
          duree_min?: number | null
          heure?: string | null
          id?: string
          lien_visio?: string | null
          lieu?: string | null
          president_seance_id?: string | null
          quorum_requis?: number
          statut?: string
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reunions_comite_id_fkey"
            columns: ["comite_id"]
            isOneToOne: false
            referencedRelation: "comites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reunions_president_seance_id_fkey"
            columns: ["president_seance_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunions_president_seance_id_fkey"
            columns: ["president_seance_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      signalements: {
        Row: {
          action_id: string | null
          auteur_id: string
          categorie: string
          created_at: string
          description: string
          id: string
          statut: string
          sujet: string
        }
        Insert: {
          action_id?: string | null
          auteur_id: string
          categorie: string
          created_at?: string
          description: string
          id?: string
          statut?: string
          sujet: string
        }
        Update: {
          action_id?: string | null
          auteur_id?: string
          categorie?: string
          created_at?: string
          description?: string
          id?: string
          statut?: string
          sujet?: string
        }
        Relationships: [
          {
            foreignKeyName: "signalements_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signalements_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signalements_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      signatures: {
        Row: {
          hash_sha256: string | null
          id: string
          image_base64: string | null
          methode: string
          pv_id: string
          pv_version: number
          signed_at: string | null
          user_id: string
        }
        Insert: {
          hash_sha256?: string | null
          id?: string
          image_base64?: string | null
          methode: string
          pv_id: string
          pv_version?: number
          signed_at?: string | null
          user_id: string
        }
        Update: {
          hash_sha256?: string | null
          id?: string
          image_base64?: string | null
          methode?: string
          pv_id?: string
          pv_version?: number
          signed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kpi_gouvernance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      votes: {
        Row: {
          clos_at: string | null
          cloture_prevue: string | null
          id: string
          intitule: string
          ouvert_at: string | null
          resolution_code: string | null
          reunion_id: string
          statut: string
        }
        Insert: {
          clos_at?: string | null
          cloture_prevue?: string | null
          id?: string
          intitule: string
          ouvert_at?: string | null
          resolution_code?: string | null
          reunion_id: string
          statut?: string
        }
        Update: {
          clos_at?: string | null
          cloture_prevue?: string | null
          id?: string
          intitule?: string
          ouvert_at?: string | null
          resolution_code?: string | null
          reunion_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reunions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_kpi_gouvernance: {
        Row: {
          nom: string | null
          presences: number | null
          procurations_donnees: number | null
          taux_presence_pct: number | null
          total_jetons_percus: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clear_password_change_flag: { Args: never; Returns: undefined }
      close_consultation: { Args: { p_consultation_id: string }; Returns: Json }
      close_discussion: {
        Args: { p_discussion_id: string }
        Returns: undefined
      }
      confirmer_cloture_action: {
        Args: { p_action_id: string }
        Returns: undefined
      }
      current_pca_email: { Args: never; Returns: string }
      delegate_president_seance: {
        Args: { p_delegate_id: string; p_reunion_id: string }
        Returns: undefined
      }
      get_kpis_gouvernance: { Args: { p_annee?: number }; Returns: Json }
      get_mes_jetons: { Args: { p_user_id?: string }; Returns: Json }
      get_reunion_stats: { Args: { p_reunion_id: string }; Returns: Json }
      is_ca_member: { Args: never; Returns: boolean }
      is_pca: { Args: never; Returns: boolean }
      is_secretaire: { Args: never; Returns: boolean }
      log_event: {
        Args: { p_action: string; p_ressource?: string }
        Returns: undefined
      }
      mark_notifications_read: {
        Args: { p_ids?: string[] }
        Returns: undefined
      }
      pin_message: {
        Args: { p_message_id: string; p_pinned: boolean }
        Returns: undefined
      }
      renvoyer_action: {
        Args: { p_action_id: string; p_motif?: string }
        Returns: undefined
      }
      renvoyer_pv: { Args: { p_pv_id: string }; Returns: undefined }
      reporter_seance: {
        Args: {
          p_motif?: string
          p_nouveau_lieu?: string
          p_nouvelle_date: string
          p_nouvelle_heure?: string
          p_reunion_id: string
        }
        Returns: string
      }
      set_discussion_visibility: {
        Args: { p_discussion_id: string; p_visible: boolean }
        Returns: undefined
      }
      set_president_ca: { Args: { p_user_id?: string }; Returns: undefined }
      soumettre_rapport_action: {
        Args: {
          p_action_id: string
          p_avancement: number
          p_fichier_nom?: string
          p_fichier_path?: string
          p_fichier_taille?: number
          p_fichier_type?: string
          p_texte: string
        }
        Returns: string
      }
      valider_paiement_jetons: {
        Args: { p_reunion_id: string; p_user_ids?: string[] }
        Returns: number
      }
    }
    Enums: {
      user_role:
        | "super_admin"
        | "secretaire"
        | "administrateur"
        | "responsable_action"
        | "invite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: [
        "super_admin",
        "secretaire",
        "administrateur",
        "responsable_action",
        "invite",
      ],
    },
  },
} as const
