
import Button from '../components/ui/Button';
import { MapPin, Phone, PawPrint, Edit, Shield, Heart, Trash, Check, X, Plus, Upload, Settings, AlertTriangle, Trash2, Briefcase, User, MessageCircle, KeyRound, Eye, EyeOff, Mail, Star, Crown, Info, Share2, BookUser, HelpCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import DienstleisterCategoryIcon, { getCategoryColor, getCategoryBgColor } from '../components/ui/DienstleisterCategoryIcon';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ownerPreferencesService, petService, userService, ownerCaretakerService } from '../lib/supabase/db';
import type { ShareSettings } from '../lib/supabase/db';
import { useAuth } from '../lib/auth/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { plzService } from '../lib/supabase/db';
import { useNavigate } from 'react-router-dom';
import { getOrCreateConversation } from '../lib/supabase/chatService';
import { supabase } from '../lib/supabase/client';
import { calculateAge } from '../lib/utils';
import PaymentSuccessModal from '../components/ui/PaymentSuccessModal';
import { usePaymentSuccess } from '../hooks/usePaymentSuccess';
import { PremiumBadge } from '../components/ui/PremiumBadge';
import { useSubscription } from '../lib/auth/useSubscription';
import RegistrationSuccessModal from '../components/ui/RegistrationSuccessModal';
import ProfileImageCropper from '../components/ui/ProfileImageCropper';
import OwnerContactTab from '../components/ui/OwnerContactTab';
import AdvertisementBanner from '../components/ui/AdvertisementBanner';
import RefGrowDashboard from '../components/ui/RefGrowDashboard';
import OwnerDashboardJobsTab from '../components/owner/OwnerDashboardJobsTab';
import { OWNER_SERVICE_TAGS } from '../lib/constants/ownerServices';
import DashboardReleaseTeaser from '../components/dashboard/DashboardReleaseTeaser';
import { ensurePlzCoordinatesCached } from '../lib/geocoding';
import ToastContainer from '../components/ui/ToastContainer';
import { useToast } from '../hooks/useToast';
import { requestOwnerApproval } from '../lib/services/ownerApprovalService';

// Typ für Haustier-Formulare
interface PetFormData {
  name: string;
  type: string;
  typeOther: string;
  breed: string;
  birthDate: string;
  weight: string;
  image: string | File;
  description: string;
  gender?: 'Rüde' | 'Hündin' | '';
  neutered?: boolean;
}

function PetPhotoUploader({ photoUrl, onEditClick, uploading }: {
  photoUrl?: string | File;
  onEditClick: () => void;
  uploading?: boolean;
}) {
  let previewUrl: string | undefined = undefined;
  if (photoUrl) {
    if (typeof photoUrl === 'string') {
      previewUrl = photoUrl;
    } else if (photoUrl instanceof File) {
      previewUrl = URL.createObjectURL(photoUrl);
    }
  }

  if (previewUrl) {
    return (
      <div className="relative mt-1">
        <div className="relative group h-24 w-24">
          <img
            src={previewUrl}
            alt="Tierfoto"
            className="h-24 w-24 object-cover rounded-xl border-2 border-gray-200"
          />
          <div
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-xl flex items-center justify-center cursor-pointer"
            onClick={onEditClick}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white rounded-full p-2 shadow-lg">
              <Edit className="h-4 w-4 text-primary-600" />
            </div>
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
              <LoadingSpinner />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onEditClick}
      className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition-colors"
    >
      {uploading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-1">Tierfoto bearbeiten</p>
          <p className="text-xs text-gray-500">Klicken zum Öffnen des Editors</p>
        </>
      )}
    </div>
  );
}

function OwnerDashboardPage() {
  const { user, userProfile, loading: authLoading, updateProfileState, signOut, subscription } = useAuth();
  const { isPremiumUser } = useSubscription();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  const [ownerApprovalLoading, setOwnerApprovalLoading] = useState(false);
  const [approvalHintDismissed, setApprovalHintDismissed] = useState(false);
  const navigate = useNavigate();
  const [profileLoadAttempts, setProfileLoadAttempts] = useState(0);
  // Onboarding-Modal State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingUserName, setOnboardingUserName] = useState<string>('');

  // Payment Success Modal
  const { paymentSuccess, isValidating: paymentValidating, closeModal } = usePaymentSuccess();

  // Refs to track if data has been loaded to prevent unnecessary reloads
  const vetDataLoadedRef = useRef(false);
  const emergencyDataLoadedRef = useRef(false);
  const prefsDataLoadedRef = useRef(false);

  // Demo: initiale Services (später aus DB laden)
  const [services, setServices] = useState<string[]>([]);
  const [otherWishes, setOtherWishes] = useState<string[]>([]);
  const [newOtherWish, setNewOtherWish] = useState('');
  const [otherWishError, setOtherWishError] = useState<string | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsSaveMsg, setPrefsSaveMsg] = useState<string | null>(null);

  const [pets, setPets] = useState<any[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [petError, setPetError] = useState<string | null>(null);
  const [showAddPet, setShowAddPet] = useState(false);
  const [newPet, setNewPet] = useState<PetFormData>({ name: '', type: '', typeOther: '', breed: '', birthDate: '', weight: '', image: '', description: '', gender: '', neutered: false });
  const [activeTab, setActiveTab] = useState<
    | 'uebersicht'
    | 'oeffentlichesProfil'
    | 'tiere'
    | 'jobs'
    | 'affiliate'
    | 'kontaktdaten'
    | 'einstellungen'
    | 'mitgliedschaft'
  >('uebersicht');
  const [editData, setEditData] = useState(false);
  const [ownerData, setOwnerData] = useState({
    phoneNumber: '',
    email: '',
    plz: '',
    street: '',
    location: '',
    dateOfBirth: '',
    gender: ''
  });
  const [editVet, setEditVet] = useState(false);
  const [vetData, setVetData] = useState({
    name: '',
    address: '',
    phone: ''
  });
  const [vetLoading, setVetLoading] = useState(false);
  const [vetError, setVetError] = useState<string | null>(null);
  const [vetSaveMsg, setVetSaveMsg] = useState<string | null>(null);
  const [editEmergency, setEditEmergency] = useState(false);
  const [emergencyData, setEmergencyData] = useState({
    name: '',
    phone: ''
  });
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);
  const [emergencySaveMsg, setEmergencySaveMsg] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [favoriteCaretakers, setFavoriteCaretakers] = useState<any[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    phoneNumber: false,
    email: false,
    address: false,
    vetInfo: false,
    emergencyContact: false,
    petDetails: false,
    carePreferences: false,
    aboutMe: true,        // NEU - default sichtbar
    profilePhoto: true    // NEU - default sichtbar
  });
  const [shareSettingsLoading, setShareSettingsLoading] = useState(false);
  const [shareSettingsError, setShareSettingsError] = useState<string | null>(null);
  const [shareSettingsSaveMsg, setShareSettingsSaveMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [editPet, setEditPet] = useState<string | null>(null);
  const [editPetData, setEditPetData] = useState<PetFormData>({ name: '', type: '', typeOther: '', breed: '', birthDate: '', weight: '', image: '', description: '', gender: '', neutered: false });
  // State für Edit-Modus und lokale Kopie der Betreuungsvorlieben
  const [editPrefs, setEditPrefs] = useState(false);
  const [editServices, setEditServices] = useState<string[]>([]);
  const [editOtherWishes, setEditOtherWishes] = useState<string[]>([]);
  const [editNewOtherWish, setEditNewOtherWish] = useState('');
  const [editOtherWishError, setEditOtherWishError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showImageCropper, setShowImageCropper] = useState(false);
  // Stabilität wie im Caretaker-Dashboard
  const [optimisticAvatarUrl, setOptimisticAvatarUrl] = useState<string | null>(null);
  const [renderProfile, setRenderProfile] = useState<any>(null);

  // Kurzvorstellung + Über mich (öffentliches Profil)
  const SHORT_INTRO_MAX = 280;
  const ABOUT_ME_MAX = 1000;
  const [shortIntro, setShortIntro] = useState<string>('');
  const [shortIntroDraft, setShortIntroDraft] = useState<string>('');
  const [aboutMe, setAboutMe] = useState<string>('');
  const [aboutMeDraft, setAboutMeDraft] = useState<string>('');
  const [aboutMeSaving, setAboutMeSaving] = useState(false);
  const [aboutMeError, setAboutMeError] = useState<string | null>(null);
  const [aboutMeSuccess, setAboutMeSuccess] = useState(false);
  const [editShortIntro, setEditShortIntro] = useState(false);
  const [editAboutMe, setEditAboutMe] = useState(false);

  // Pet Image Cropper States
  const [showPetImageCropper, setShowPetImageCropper] = useState(false);
  const [petCropperMode, setPetCropperMode] = useState<'new' | 'edit'>('new');
  const [petImageUploading, setPetImageUploading] = useState(false);
  const [petImageError, setPetImageError] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal states für Betreuer löschen
  const [showDeleteCaretakerModal, setShowDeleteCaretakerModal] = useState(false);
  const [caretakerToDelete, setCaretakerToDelete] = useState<any | null>(null);
  const [deleteCaretakerConfirmationText, setDeleteCaretakerConfirmationText] = useState('');

  // State für Favoriten entfernen
  const [removingFavoriteId, setRemovingFavoriteId] = useState<string | null>(null);

  // State für Passwort ändern
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Im Komponenten-Body (OwnerDashboardPage), nach den anderen useState-Definitionen:
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null);

  // Load user data on component mount and when userProfile changes
  useEffect(() => {
    // console.log('✨ OwnerDashboardPage userProfile effect triggered.'); // Clean up debug log
    // console.log('🔍 Current userProfile:', userProfile); // Clean up debug log
    // console.log('🔍 userProfile.postal_code:', userProfile?.postal_code); // Clean up debug log

    if (userProfile) {
      setOwnerData({
        phoneNumber: userProfile.phone_number || '',
        email: userProfile.email || '',
        plz: userProfile.plz || '',
        street: userProfile.street || '',
        location: userProfile.city || '',
        dateOfBirth: userProfile.date_of_birth || '',
        gender: userProfile.gender || '',
      });
    } else if (user && !authLoading) {
      // Fallback: Setze E-Mail vom Auth-User
      setOwnerData(prev => ({
        ...prev,
        email: user.email || ''
      }));
    }
  }, [userProfile, user, authLoading]);

  // Load Kurzvorstellung + about_me from userProfile
  useEffect(() => {
    if (!userProfile) return;
    const si = userProfile.short_intro ?? '';
    const am = userProfile.about_me ?? '';
    setShortIntro(si);
    setShortIntroDraft(si);
    setAboutMe(am);
    setAboutMeDraft(am);
  }, [userProfile]);

  // Onboarding nach Dashboard-Load starten (nur einmal, via sessionStorage)
  useEffect(() => {
    if (!authLoading && user) {
      try {
        const raw = sessionStorage.getItem('onboardingData');
        if (raw) {
          const parsed = JSON.parse(raw) as { userType?: 'owner' | 'caretaker'; userName?: string };
          console.log('🔍 OwnerDashboard: Checking onboarding data:', parsed);
          if (!parsed.userType || parsed.userType === 'owner') {
            console.log('✅ OwnerDashboard: Starting owner onboarding for:', parsed.userName);
            setOnboardingUserName(parsed.userName || userProfile?.first_name || '');
            setShowOnboarding(true);
          }
          sessionStorage.removeItem('onboardingData');
        }
      } catch (e) {
        console.warn('⚠️ Konnte onboardingData nicht lesen:', e);
      }
    }
  }, [authLoading, user, userProfile]);

  // Zusätzlicher useEffect für robustes Profile-Loading nach Registrierung
  useEffect(() => {
    const ensureProfileLoaded = async () => {
      if (user && !userProfile && !authLoading && profileLoadAttempts < 5) {
        console.log(`🔄 OwnerDashboard: userProfile missing, attempt ${profileLoadAttempts + 1}/5`);
        setProfileLoadAttempts(prev => prev + 1);

        // Verzögerung zwischen Versuchen
        await new Promise(resolve => setTimeout(resolve, 300 * (profileLoadAttempts + 1)));

        try {
          const { userService } = await import('../lib/supabase/db');
          const { data: freshProfile, error } = await userService.getUserProfile(user.id);

          if (!error && freshProfile) {
            console.log('✅ OwnerDashboard: Profile manually reloaded:', freshProfile);
            // Zwinge einen Re-Render durch setzen der ownerData
            setOwnerData({
              phoneNumber: freshProfile.phone_number || '',
              email: user.email || '',
              plz: freshProfile.plz || '',
              street: (freshProfile as any).street || '',
              location: freshProfile.city || '',
              dateOfBirth: freshProfile.date_of_birth || '',
              gender: freshProfile.gender || ''
            });
          }
        } catch (error) {
          console.error('❌ OwnerDashboard: Failed to manually reload profile:', error);
        }
      }
    };

    ensureProfileLoaded();
  }, [user, userProfile, authLoading, profileLoadAttempts]);

  // Haustiere aus DB laden
  useEffect(() => {
    const fetchPets = async () => {
      if (!user) return;
      setPetsLoading(true);
      setPetError(null);
      try {
        const { data, error } = await petService.getOwnerPets(user.id);
        if (error) {
          setPetError('Fehler beim Laden der Tiere!');
          setPets([]);
        } else {
          // Mappe DB-Felder auf UI-Felder
          setPets(
            (data || []).map((pet: any) => ({
              id: pet.id,
              name: pet.name,
              type: pet.type,
              breed: pet.breed || '',
              birthDate: pet.birth_date || '',
              weight: pet.weight ?? '',
              image: pet.photo_url || '',
              description: pet.description || '',
              gender: pet.gender || '',
              neutered: pet.neutered || false,
            }))
          );
        }
      } catch (e) {
        setPetError('Fehler beim Laden der Tiere!');
        setPets([]);
      } finally {
        setPetsLoading(false);
      }
    };
    fetchPets();
  }, [user]);

  // Gespeicherte Betreuer aus DB laden
  useEffect(() => {
    const fetchSavedCaretakers = async () => {
      if (!user) return;
      setContactsLoading(true);
      setContactsError(null);
      try {
        const { data, error } = await ownerCaretakerService.getSavedCaretakers(user.id);
        if (error) {
          setContactsError('Fehler beim Laden der Betreuer!');
          setContacts([]);
        } else {
          setContacts(data || []);
        }
      } catch (e) {
        setContactsError('Fehler beim Laden der Betreuer!');
        setContacts([]);
      } finally {
        setContactsLoading(false);
      }
    };

    fetchSavedCaretakers();
  }, [user]);

  // Favoriten aus DB laden
  useEffect(() => {
    const fetchFavoriteCaretakers = async () => {
      if (!user) return;
      setFavoritesLoading(true);
      setFavoritesError(null);
      try {
        const { data, error } = await ownerCaretakerService.getFavoriteCaretakers(user.id);
        if (error) {
          setFavoritesError('Fehler beim Laden der Favoriten!');
          setFavoriteCaretakers([]);
        } else {
          setFavoriteCaretakers(data || []);
        }
      } catch (e) {
        setFavoritesError('Fehler beim Laden der Favoriten!');
        setFavoriteCaretakers([]);
      } finally {
        setFavoritesLoading(false);
      }
    };

    fetchFavoriteCaretakers();
  }, [user]);

  // Tierarzt-Infos aus DB laden - nur einmal und nicht im Edit-Modus
  useEffect(() => {
    if (activeTab !== 'einstellungen' || !user || editVet || vetDataLoadedRef.current) return;

    setVetLoading(true);
    setVetError(null);
    ownerPreferencesService.getPreferences(user.id)
      .then(({ data, error }) => {
        if (error) {
          setVetError('Fehler beim Laden der Tierarzt-Informationen!');
          setVetData({ name: '', address: '', phone: '' });
        } else if (data) {
          // vet_info kann als JSON oder als einzelne Felder vorliegen
          let name = '', address = '', phone = '';
          if (data.vet_info) {
            try {
              const info = typeof data.vet_info === 'string' ? JSON.parse(data.vet_info) : data.vet_info;
              name = info.name || '';
              address = info.address || '';
              phone = info.phone || '';
            } catch {
              // Fallback: evtl. plain string
              name = data.vet_info;
            }
          }
          setVetData({ name, address, phone });
        } else {
          // Keine Daten gefunden - setze leere Standardwerte
          setVetData({ name: '', address: '', phone: '' });
        }
        vetDataLoadedRef.current = true;
      })
      .catch(() => setVetError('Fehler beim Laden der Tierarzt-Informationen!'))
      .finally(() => setVetLoading(false));
  }, [activeTab, user, editVet]);

  // Notfallkontakt aus DB laden - nur einmal und nicht im Edit-Modus
  useEffect(() => {
    if (activeTab !== 'einstellungen' || !user || editEmergency || emergencyDataLoadedRef.current) return;

    setEmergencyLoading(true);
    setEmergencyError(null);
    ownerPreferencesService.getPreferences(user.id)
      .then(({ data, error }) => {
        if (error) {
          setEmergencyError('Fehler beim Laden des Notfallkontakts!');
          setEmergencyData({ name: '', phone: '' });
        } else if (data) {
          setEmergencyData({
            name: data.emergency_contact_name || '',
            phone: data.emergency_contact_phone || ''
          });
        } else {
          // Keine Daten gefunden - setze leere Standardwerte
          setEmergencyData({ name: '', phone: '' });
        }
        emergencyDataLoadedRef.current = true;
      })
      .catch(() => setEmergencyError('Fehler beim Laden des Notfallkontakts!'))
      .finally(() => setEmergencyLoading(false));
  }, [activeTab, user, editEmergency]);

  // Betreuungsvorlieben aus DB laden - nur einmal und nicht im Edit-Modus
  useEffect(() => {
    if (activeTab !== 'einstellungen' || !user || editPrefs || prefsDataLoadedRef.current) return;

    setPrefsLoading(true);
    setPrefsError(null);
    ownerPreferencesService.getPreferences(user.id)
      .then(({ data, error }) => {
        if (error) {
          setPrefsError('Fehler beim Laden der Betreuungsvorlieben!');
          setServices([]);
          setOtherWishes([]);
        } else if (data) {
          setServices(data.services || []);
          // Sonstige Wünsche: als String (mit Komma oder Zeilenumbruch getrennt) oder Array
          let wishes: string[] = [];
          if (Array.isArray(data.other_services)) {
            wishes = data.other_services;
          } else if (typeof data.other_services === 'string') {
            wishes = data.other_services.split(/,|\n/).map((w: string) => w.trim()).filter(Boolean);
          }
          setOtherWishes(wishes);
        } else {
          // Keine Daten gefunden - setze leere Standardwerte
          setServices([]);
          setOtherWishes([]);
        }
        prefsDataLoadedRef.current = true;
      })
      .catch(() => setPrefsError('Fehler beim Laden der Betreuungsvorlieben!'))
      .finally(() => setPrefsLoading(false));
  }, [activeTab, user, editPrefs]);

  // Share-Settings aus Datenbank laden
  useEffect(() => {
    const loadShareSettings = async () => {
      if (!user) return;

      try {
        const { data, error } = await ownerPreferencesService.getShareSettings(user.id);
        if (error) {
          console.warn('Fehler beim Laden der Datenschutz-Einstellungen:', error);
          // Behalte Standardwerte bei
        } else if (data) {
          setShareSettings(data);
        }
      } catch (e) {
        console.warn('Fehler beim Laden der Datenschutz-Einstellungen:', e);
        // Behalte Standardwerte bei
      }
    };

    loadShareSettings();
  }, [user]);

  // Keine Early-Return-Ladeanzeige mehr: UI bleibt stabil sichtbar, auch wenn das Profil kurz neu geladen wird

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Nicht angemeldet</h2>
          <p className="text-gray-600">Bitte melde dich an, um dein Dashboard zu sehen.</p>
        </div>
      </div>
    );
  }

  // Keine globale Spinner-Übernahme mehr – wir rendern immer mit Fallback-Profil

  // Kein Early-Return mehr; wir verwenden immer ein Fallback-Profil

  // Fallback für fehlende Profile-Daten
  const fallbackProfile = {
    first_name: user.email?.split('@')[0] || 'Benutzer',
    last_name: '',
    email: user.email || '',
    phone_number: '',
    plz: '',
    city: '',
    user_type: 'owner' as const,
    avatar_url: null
  };

  const profile = renderProfile || userProfile || fallbackProfile;
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unbekannter Benutzer';
  const avatarUrl = optimisticAvatarUrl
    || profile.profile_photo_url
    || profile.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=f3f4f6&color=374151`;

  // Debug-Info wenn Profile fehlt
  if (!userProfile) {
    console.warn('⚠️ UserProfile missing, using fallback data for user:', user.id);
  }

  // handleServiceToggle: jetzt mit Autosave
  const handleServiceToggle = (service: string) => {
    setServices((prev) => {
      const updated = prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service];
      autosavePreferences(updated, otherWishes);
      return updated;
    });
  };

  // handleAddOtherWish: jetzt mit Autosave
  const handleAddOtherWish = () => {
    const trimmed = newOtherWish.trim();
    if (!trimmed) return;
    const exists = otherWishes.some(w => w.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setOtherWishError('Dieser Wunsch existiert bereits!');
      return;
    }
    const updated = [...otherWishes, trimmed];
    setOtherWishes(updated);
    setNewOtherWish('');
    setOtherWishError(null);
    autosavePreferences(services, updated);
  };

  // handleRemoveOtherWish: jetzt mit Autosave
  const handleRemoveOtherWish = (idx: number) => {
    const updated = otherWishes.filter((_, i) => i !== idx);
    setOtherWishes(updated);
    setOtherWishError(null);
    autosavePreferences(services, updated);
  };

  // Autosave-Funktion für Betreuungsvorlieben
  const autosavePreferences = async (servicesToSave: string[], wishesToSave: string[]) => {
    if (!user) return;
    setPrefsLoading(true);
    setPrefsSaveMsg(null);
    setPrefsError(null);
    try {
      const { error } = await ownerPreferencesService.savePreferences(user.id, {
        services: servicesToSave,
        otherServices: wishesToSave.join(', '),
      });
      if (error) {
        setPrefsError('Fehler beim Speichern der Betreuungsvorlieben!');
      } else {
        setPrefsSaveMsg('Betreuungsvorlieben erfolgreich gespeichert!');
      }
    } catch {
      setPrefsError('Fehler beim Speichern der Betreuungsvorlieben!');
    } finally {
      setPrefsLoading(false);
      setTimeout(() => setPrefsSaveMsg(null), 4000);
    }
  };



  // Hilfsfunktion für Pet-Image-Upload
  async function uploadPetPhoto(file: File): Promise<string> {
    const { supabase } = await import('../lib/supabase/client');
    const fileExt = file.name.split('.').pop();
    const filePath = `pet-${user!.id}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('pet-photos').upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(filePath);
    return urlData.publicUrl;
  }

  // Haustier hinzufügen (DB)
  const handleAddPet = async () => {
    if (!user) return;
    if (!newPet.name.trim() || !newPet.type.trim() || (newPet.type === 'Andere' && !newPet.typeOther.trim())) return;
    const typeValue = newPet.type === 'Andere' ? newPet.typeOther : newPet.type;
    let photoUrl = '';
    if (newPet.image && typeof newPet.image !== 'string') {
      photoUrl = await uploadPetPhoto(newPet.image);
    } else if (typeof newPet.image === 'string') {
      photoUrl = newPet.image;
    }
    const petData = {
      name: newPet.name,
      type: typeValue,
      breed: newPet.breed,
      birthDate: newPet.birthDate,
      weight: newPet.weight ? Number(newPet.weight) : undefined,
      photoUrl: photoUrl,
      description: newPet.description,
      gender: newPet.gender || '',
      neutered: newPet.neutered || false,
    };
    try {
      const { error } = await petService.addPet(user.id, petData);
      if (error) throw error;
      const { data } = await petService.getOwnerPets(user.id);
      setPets((data || []).map((pet: any) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        breed: pet.breed || '',
        birthDate: pet.birth_date || '',
        weight: pet.weight ?? '',
        image: pet.photo_url || '',
        description: pet.description || '',
        gender: pet.gender || '',
        neutered: pet.neutered || false,
      })));
      setShowAddPet(false);
      setNewPet({ name: '', type: '', typeOther: '', breed: '', birthDate: '', weight: '', image: '', description: '', gender: '', neutered: false });
    } catch (e) {
      setPetError('Fehler beim Hinzufügen des Tiers!');
    }
  };

  // Haustier bearbeiten (DB)
  const handleSavePet = async () => {
    if (!user) return;
    if (!editPet) return; // Guard: keine ID, kein Update
    if (!editPetData.name.trim()) return;
    let photoUrl = '';
    if (editPetData.image && typeof editPetData.image !== 'string') {
      photoUrl = await uploadPetPhoto(editPetData.image);
    } else if (typeof editPetData.image === 'string') {
      photoUrl = editPetData.image;
    }
    const petData = {
      name: editPetData.name,
      type: editPetData.type === 'Andere' ? editPetData.typeOther : editPetData.type,
      breed: editPetData.breed,
      birthDate: editPetData.birthDate,
      weight: editPetData.weight ? Number(editPetData.weight) : undefined,
      photoUrl: photoUrl,
      description: editPetData.description,
      gender: editPetData.gender || '',
      neutered: editPetData.neutered || false,
    };
    try {
      const { error } = await petService.updatePet(editPet, petData);
      if (error) throw error;
      const { data } = await petService.getOwnerPets(user.id);
      setPets((data || []).map((pet: any) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        breed: pet.breed || '',
        birthDate: pet.birth_date || '',
        weight: pet.weight ?? '',
        image: pet.photo_url || '',
        description: pet.description || '',
        gender: pet.gender || '',
        neutered: pet.neutered || false,
      })));
      setEditPet(null);
      setEditPetData({ name: '', type: '', typeOther: '', breed: '', birthDate: '', weight: '', image: '', description: '', gender: '', neutered: false });
    } catch (e) {
      setPetError('Fehler beim Bearbeiten des Tiers!');
    }
  };

  // Haustier löschen (DB)
  const handleDeletePet = async (petId: string) => {
    if (!user) return;
    try {
      const { error } = await petService.deletePet(petId);
      if (error) throw error;
      const { data } = await petService.getOwnerPets(user.id);
      setPets((data || []).map((pet: any) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        breed: pet.breed || '',
        birthDate: pet.birth_date || '',
        weight: pet.weight ?? '',
        image: pet.photo_url || '',
        description: pet.description || '',
        gender: pet.gender || '',
        neutered: pet.neutered || false,
      })));
      setEditPet(null);
    } catch (e) {
      setPetError('Fehler beim Löschen des Tiers!');
    }
  };

  // Öffne Pet Image Cropper für neues Tier
  const handleNewPetPhotoClick = () => {
    setPetCropperMode('new');
    setShowPetImageCropper(true);
  };

  // Öffne Pet Image Cropper für Edit
  const handleEditPetPhotoClick = () => {
    setPetCropperMode('edit');
    setShowPetImageCropper(true);
  };

  // Hilfsfunktion um Pet Image URL zu bekommen
  const getPetImageUrl = (image: string | File | undefined): string | undefined => {
    if (!image) return undefined;
    if (typeof image === 'string') return image;
    if (image instanceof File) return URL.createObjectURL(image);
    return undefined;
  };

  // Pet Image Cropper Save Handler
  const handlePetCroppedImageSave = async (croppedImageUrl: string) => {
    setPetImageUploading(true);
    setPetImageError(null);
    try {
      // Konvertiere Data URL zu Blob
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], `pet-${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Je nach Modus das entsprechende Pet-Objekt aktualisieren
      if (petCropperMode === 'new') {
        setNewPet(p => ({ ...p, image: file }));
      } else {
        setEditPetData(p => ({ ...p, image: file }));
      }

      setShowPetImageCropper(false); // Modal schließen
    } catch (e: any) {
      setPetImageError('Fehler beim Bearbeiten des Tierfotos!');
      throw e;
    } finally {
      setPetImageUploading(false);
    }
  };

  const handleEditPet = (pet: any) => {
    setEditPet(pet.id);
    setEditPetData({
      name: pet.name,
      type: pet.type,
      typeOther: '',
      breed: pet.breed,
      birthDate: pet.birthDate || '',
      weight: pet.weight?.toString() || '',
      image: pet.image,
      description: pet.description || '',
      gender: pet.gender || '',
      neutered: pet.neutered || false,
    });
  };

  const handleDeleteContact = (caregiver: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCaretakerToDelete(caregiver);
    setShowDeleteCaretakerModal(true);
  };

  const handleDeleteCaretakerConfirm = async () => {
    if (caretakerToDelete && deleteCaretakerConfirmationText === 'BETREUER ENTFERNEN' && user) {
      try {
        const { error } = await ownerCaretakerService.removeCaretaker(user.id, caretakerToDelete.id);
        if (error) {
          console.error('Fehler beim Entfernen des Betreuers:', error);
          alert('Fehler beim Entfernen des Betreuers. Bitte versuche es erneut.');
          return;
        }

        // Aktualisiere lokalen State
        setContacts(prev => prev.filter(contact => contact.id !== caretakerToDelete.id));

        // Modal schließen
        setShowDeleteCaretakerModal(false);
        setCaretakerToDelete(null);
        setDeleteCaretakerConfirmationText('');

        // Erfolgsbenachrichtigung
        alert(`${caretakerToDelete.name} wurde erfolgreich entfernt und hat keinen Zugriff mehr auf dein Profil.`);
      } catch (error) {
        console.error('Fehler beim Entfernen des Betreuers:', error);
        alert('Fehler beim Entfernen des Betreuers. Bitte versuche es erneut.');
      }
    }
  };

  const handleDeleteCaretakerCancel = () => {
    setShowDeleteCaretakerModal(false);
    setCaretakerToDelete(null);
    setDeleteCaretakerConfirmationText('');
  };

  // Favoriten entfernen Handler
  const handleRemoveFavorite = async (caregiver: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;

    setRemovingFavoriteId(caregiver.id);

    try {
      const { error } = await ownerCaretakerService.toggleFavorite(user.id, caregiver.id);

      if (error) {
        console.error('Fehler beim Entfernen des Favoriten:', error);
        alert('Fehler beim Entfernen des Favoriten. Bitte versuche es erneut.');
        return;
      }

      // Entferne den Favoriten aus der lokalen Liste
      setFavoriteCaretakers(prev => prev.filter(fav => fav.id !== caregiver.id));

    } catch (error) {
      console.error('Unerwarteter Fehler beim Entfernen des Favoriten:', error);
      alert('Fehler beim Entfernen des Favoriten. Bitte versuche es erneut.');
    } finally {
      setRemovingFavoriteId(null);
    }
  };

  const handleStartChat = async (caregiver: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;

    try {
      // Erstelle oder finde bestehende Konversation
      const { data: conversation, error } = await getOrCreateConversation({
        owner_id: user.id,
        caretaker_id: caregiver.id
      });

      if (error) {
        console.error('Fehler beim Erstellen der Konversation:', error);
        // TODO: Toast-Benachrichtigung anzeigen
        return;
      }

      if (conversation) {
        // Navigiere direkt zum Chat
        navigate(`/nachrichten/${conversation.id}`);
      }
    } catch (error) {
      console.error('Unerwarteter Fehler beim Starten des Chats:', error);
      // TODO: Toast-Benachrichtigung anzeigen
    }
  };

  const handleShareToggle = async (setting: keyof ShareSettings) => {
    if (!user) return;

    const newSettings = {
      ...shareSettings,
      [setting]: !shareSettings[setting]
    };

    // Optimistisches Update für bessere UX
    setShareSettings(newSettings);
    setShareSettingsLoading(true);
    setShareSettingsError(null);
    setShareSettingsSaveMsg(null);

    try {
      // Echte Datenbank-Speicherung
      const { error } = await ownerPreferencesService.saveShareSettings(user.id, newSettings);

      if (error) {
        // Bei Fehler: Rollback der UI-Änderung
        setShareSettings(shareSettings);
        setShareSettingsError('Fehler beim Speichern der Datenschutz-Einstellungen!');
      } else {
        setShareSettingsSaveMsg('Datenschutz-Einstellungen erfolgreich gespeichert!');
        setTimeout(() => setShareSettingsSaveMsg(null), 3000);
      }
    } catch (e) {
      // Bei Fehler: Rollback der UI-Änderung
      setShareSettings(shareSettings);
      setShareSettingsError('Fehler beim Speichern der Datenschutz-Einstellungen!');
    } finally {
      setShareSettingsLoading(false);
    }
  };

  const handlePhoneNumberChange = (value: string, field: 'phoneNumber' | 'emergencyPhone' | 'vetPhone') => {
    // Nur Zahlen, Leerzeichen, Plus und Bindestriche erlauben
    const phoneRegex = /^[+\d\s-]*$/;
    if (phoneRegex.test(value)) {
      if (field === 'phoneNumber') {
        setOwnerData(d => ({ ...d, phoneNumber: value }));
      } else if (field === 'emergencyPhone') {
        setEmergencyData(d => ({ ...d, phone: value }));
      } else if (field === 'vetPhone') {
        setVetData(d => ({ ...d, phone: value }));
      }
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value: string) => {
    setOwnerData(d => ({ ...d, email: value }));

    if (value.trim() === '') {
      setEmailError('E-Mail-Adresse ist ein Pflichtfeld');
    } else if (!validateEmail(value)) {
      setEmailError('Bitte gib eine gültige E-Mail-Adresse ein');
    } else {
      setEmailError(null);
    }
  };

  const handleSaveOwnerData = async () => {
    if (!user) return; // Should not happen due to auth check, but for safety

    try {
      // Prepare data for updateProfile
      const dataToUpdate: { [key: string]: any } = {};

      // Only include fields that have changed
      if (ownerData.phoneNumber !== (userProfile?.phone_number || '')) dataToUpdate.phoneNumber = ownerData.phoneNumber;
      if (ownerData.street !== (userProfile?.street || '')) dataToUpdate.street = ownerData.street;
      if (ownerData.dateOfBirth !== (userProfile?.date_of_birth || '')) dataToUpdate.dateOfBirth = ownerData.dateOfBirth || null;
      if (ownerData.gender !== (userProfile?.gender || '')) dataToUpdate.gender = ownerData.gender || null;

      // Handle PLZ and City logic
      const plzChanged = ownerData.plz !== (userProfile?.plz || '');
      const cityChanged = ownerData.location !== (userProfile?.city || '');

      if (plzChanged || cityChanged) {
        // Check if PLZ+Stadt-Kombination exists in plzs table
        const { data: existingPlzCity, error: plzError } = await plzService.getByPlzAndCity(ownerData.plz, ownerData.location);

        if (plzError && plzError.code !== 'PGRST116') { // PGRST116 means not found, which is expected if new
          console.error('Error checking PLZ+Stadt in plzs table:', plzError);
          throw new Error(`Fehler bei der PLZ-Prüfung: ${plzError.message}`);
        }

        if (!existingPlzCity) {
          // PLZ+Stadt-Kombination does not exist, create it in plzs table
          console.log('PLZ+Stadt not found in plzs table, creating...');
          const { error: createPlzError } = await plzService.create(ownerData.plz, ownerData.location);

          if (createPlzError) {
            console.error('Error creating PLZ+Stadt in plzs table:', createPlzError);
            // Continue updating user profile even if adding to plzs fails, but log error
          } else {
            console.log('PLZ+Stadt successfully created in plzs table.');
          }
        }

        // Add PLZ and City to dataToUpdate for users table
        dataToUpdate.plz = ownerData.plz;
        dataToUpdate.city = ownerData.location;
      }

      // If no fields have changed, exit without saving
      if (Object.keys(dataToUpdate).length === 0) {
        return;
      }

      // Call the service to update the user profile
      const { data: updatedProfile, error: updateError } = await userService.updateUserProfile(user.id, dataToUpdate);

      if (updateError) {
        console.error('Fehler beim Speichern der Kontaktdaten:', updateError);
      } else {
        if (dataToUpdate.plz && dataToUpdate.city) {
          void ensurePlzCoordinatesCached(
            supabase,
            String(dataToUpdate.plz),
            String(dataToUpdate.city)
          );
        }
        // Profil nach dem Speichern neu laden (Race-Condition vermeiden)
        const { data: freshProfile, error: freshError } = await userService.getUserProfile(user.id);
        if (!freshError && freshProfile) {
          updateProfileState(freshProfile);
        }
        setEditData(false);
      }
    } catch (e) {
      console.error('Exception beim Speichern der Kontaktdaten:', e);
    }
  };

  const handleCancelEdit = () => {
    // Reset ownerData to current userProfile values
    if (userProfile) {
      setOwnerData({
        phoneNumber: userProfile.phone_number || '',
        email: userProfile.email || '',
        plz: userProfile.plz || '',
        street: userProfile.street || '',
        location: userProfile.city || '',
        dateOfBirth: userProfile.date_of_birth || '',
        gender: userProfile.gender || '',
      });
    } else if (user) {
      // Fallback for users without a profile yet
      setOwnerData(prev => ({
        ...prev,
        email: user.email || '' // Keep email from auth if profile is missing
      }));
    } else {
      // Should not happen
      setOwnerData({ phoneNumber: '', email: '', plz: '', street: '', location: '', dateOfBirth: '', gender: '' });
    }
    setEditData(false); // Exit edit mode
  };

  // Tierarzt-Infos speichern
  const handleSaveVet = async () => {
    if (!user) return;
    setVetLoading(true);
    setVetSaveMsg(null);
    setVetError(null);
    try {
      const { error } = await ownerPreferencesService.saveVetInfo(
        user.id,
        vetData.name,
        vetData.address,
        vetData.phone
      );
      if (error) {
        setVetError('Fehler beim Speichern der Tierarzt-Informationen!');
      } else {
        setVetSaveMsg('Tierarzt-Informationen erfolgreich gespeichert!');
        setEditVet(false);
        // Reset loaded flag nach dem Speichern für erneutes Laden bei Bedarf
        vetDataLoadedRef.current = false;
      }
    } catch {
      setVetError('Fehler beim Speichern der Tierarzt-Informationen!');
    } finally {
      setVetLoading(false);
      setTimeout(() => setVetSaveMsg(null), 4000);
    }
  };

  // Notfallkontakt speichern
  const handleSaveEmergency = async () => {
    if (!user) return;
    setEmergencyLoading(true);
    setEmergencySaveMsg(null);
    setEmergencyError(null);
    try {
      const { error } = await ownerPreferencesService.saveEmergencyContact(
        user.id,
        emergencyData.name,
        emergencyData.phone
      );
      if (error) {
        setEmergencyError('Fehler beim Speichern des Notfallkontakts!');
      } else {
        setEmergencySaveMsg('Notfallkontakt erfolgreich gespeichert!');
        setEditEmergency(false);
        // Reset loaded flag nach dem Speichern für erneutes Laden bei Bedarf
        emergencyDataLoadedRef.current = false;
      }
    } catch {
      setEmergencyError('Fehler beim Speichern des Notfallkontakts!');
    } finally {
      setEmergencyLoading(false);
      setTimeout(() => setEmergencySaveMsg(null), 4000);
    }
  };

  const persistPublicProfileTexts = async (payload: { shortIntro: string | null; aboutMe: string | null }) => {
    if (!user) return false;
    setAboutMeSaving(true);
    setAboutMeError(null);
    setAboutMeSuccess(false);
    try {
      const { error } = await userService.updateUserProfile(user.id, {
        shortIntro: payload.shortIntro,
        aboutMe: payload.aboutMe
      });
      if (error) {
        setAboutMeError('Fehler beim Speichern!');
        setTimeout(() => setAboutMeError(null), 3000);
        return false;
      }
      if (updateProfileState) {
        updateProfileState({
          short_intro: payload.shortIntro,
          about_me: payload.aboutMe
        });
      }
      setAboutMeSuccess(true);
      setTimeout(() => {
        setAboutMeSuccess(false);
        setAboutMeError(null);
      }, 3000);
      return true;
    } catch {
      setAboutMeError('Fehler beim Speichern!');
      setTimeout(() => setAboutMeError(null), 3000);
      return false;
    } finally {
      setAboutMeSaving(false);
    }
  };

  const handleSaveShortIntro = async () => {
    const ok = await persistPublicProfileTexts({
      shortIntro: shortIntroDraft.trim() || null,
      aboutMe: aboutMe.trim() || null
    });
    if (ok) {
      setShortIntro(shortIntroDraft);
      setEditShortIntro(false);
    }
  };

  const handleSaveAboutMeSection = async () => {
    const ok = await persistPublicProfileTexts({
      shortIntro: shortIntro.trim() || null,
      aboutMe: aboutMeDraft.trim() || null
    });
    if (ok) {
      setAboutMe(aboutMeDraft);
      setEditAboutMe(false);
    }
  };

  // handleOtherWishKeyDown für das Wünsche-Input (Enter: hinzufügen, Escape: leeren)
  const handleOtherWishKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOtherWish();
    } else if (e.key === 'Escape') {
      setNewOtherWish('');
      setOtherWishError(null);
    }
  };

  // Edit-Modus aktivieren: lokale Kopie der aktuellen Werte
  const handleEditPrefs = () => {
    setEditPrefs(true);
    setEditServices(services);
    setEditOtherWishes(otherWishes);
    setEditNewOtherWish('');
    setEditOtherWishError(null);
  };

  // Edit-Modus abbrechen: zurücksetzen
  const handleCancelEditPrefs = () => {
    setEditPrefs(false);
    setEditServices([]);
    setEditOtherWishes([]);
    setEditNewOtherWish('');
    setEditOtherWishError(null);
  };

  // Checkbox-Änderung im Edit-Modus
  const handleEditServiceToggle = (service: string) => {
    setEditServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  // Wünsche hinzufügen/entfernen im Edit-Modus
  const handleEditAddOtherWish = () => {
    const trimmed = editNewOtherWish.trim();
    if (!trimmed) return;
    const exists = editOtherWishes.some(w => w.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setEditOtherWishError('Dieser Wunsch existiert bereits!');
      return;
    }
    setEditOtherWishes((prev) => [...prev, trimmed]);
    setEditNewOtherWish('');
    setEditOtherWishError(null);
  };
  const handleEditRemoveOtherWish = (idx: number) => {
    setEditOtherWishes((prev) => prev.filter((_, i) => i !== idx));
    setEditOtherWishError(null);
  };
  const handleEditOtherWishKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditAddOtherWish();
    } else if (e.key === 'Escape') {
      setEditNewOtherWish('');
      setEditOtherWishError(null);
    }
  };

  // Prüfen, ob Änderungen vorliegen
  const prefsChanged =
    JSON.stringify(editServices) !== JSON.stringify(services) ||
    JSON.stringify(editOtherWishes) !== JSON.stringify(otherWishes);

  // Speichern der Änderungen
  const handleSaveEditPrefs = async () => {
    if (!user) return;
    setPrefsLoading(true);
    setPrefsSaveMsg(null);
    setPrefsError(null);
    try {
      const { error } = await ownerPreferencesService.savePreferences(user.id, {
        services: editServices,
        otherServices: editOtherWishes.join(', '),
      });
      if (error) {
        setPrefsError('Fehler beim Speichern der Betreuungsvorlieben!');
      } else {
        setPrefsSaveMsg('Betreuungsvorlieben erfolgreich gespeichert!');
        setServices(editServices);
        setOtherWishes(editOtherWishes);
        setEditPrefs(false);
        // Reset loaded flag nach dem Speichern für erneutes Laden bei Bedarf
        prefsDataLoadedRef.current = false;
      }
    } catch {
      setPrefsError('Fehler beim Speichern der Betreuungsvorlieben!');
    } finally {
      setPrefsLoading(false);
      setTimeout(() => setPrefsSaveMsg(null), 4000);
    }
  };

  // Profilbild-Upload
  async function uploadProfilePhoto(file: File): Promise<string> {
    const { supabase } = await import('../lib/supabase/client');
    const fileExt = file.name.split('.').pop();
    const filePath = `profile-${user!.id}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('profile-photos').upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(filePath);
    return urlData.publicUrl;
  }

  // Funktion für ProfileImageCropper
  const handleCroppedImageSave = async (croppedImageUrl: string) => {
    if (!user) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      // Konvertiere Data URL zu Blob
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], `profile-${user.id}-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const url = await uploadProfilePhoto(file);
      // Optimistisch sofort anzeigen und Modal schließen
      setOptimisticAvatarUrl(url);
      setShowImageCropper(false);

      const { data, error } = await userService.updateUserProfile(user.id, { profilePhotoUrl: url });
      if (error) throw error;
      if (data && data[0]) {
        // Lokalen Snapshot aktualisieren; kein globaler Reload nötig
        setRenderProfile(data[0]);
        updateProfileState(data[0]);
      }
    } catch (e: any) {
      setAvatarError('Fehler beim Hochladen des Profilbilds!');
      // Optimistische URL zurücksetzen bei Fehler
      setOptimisticAvatarUrl(null);
      throw e; // Damit ProfileImageCropper den Fehler mitbekommt
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await userService.deleteUser(user.id);
      if (error) {
        console.error('Fehler beim Löschen des Kontos:', error);
        alert('Fehler beim Löschen des Kontos. Bitte versuche es erneut.');
        setIsDeleting(false);
        return;
      }

      // Nach erfolgreichem Löschen: Ausloggen und zur Startseite
      await signOut();
      navigate('/', {
        replace: true,
        state: {
          message: 'Dein Konto wurde erfolgreich gelöscht. Alle deine Daten wurden aus der Datenbank entfernt.'
        }
      });
    } catch (error) {
      console.error('Fehler beim Löschen des Kontos:', error);
      alert('Fehler beim Löschen des Kontos. Bitte versuche es erneut.');
      setIsDeleting(false);
    }
  };

  // Cancel-Handler für Veterinär-Bearbeitung
  const handleCancelEditVet = () => {
    setEditVet(false);
    // Lade die ursprünglichen Daten erneut
    vetDataLoadedRef.current = false;
    // Trigger reload through useEffect by resetting ref and calling it manually
    if (user && activeTab === 'einstellungen') {
      setVetLoading(true);
      setVetError(null);
      ownerPreferencesService.getPreferences(user.id)
        .then(({ data, error }) => {
          if (error) {
            setVetError('Fehler beim Laden der Tierarzt-Informationen!');
            setVetData({ name: '', address: '', phone: '' });
          } else if (data) {
            let name = '', address = '', phone = '';
            if (data.vet_info) {
              try {
                const info = typeof data.vet_info === 'string' ? JSON.parse(data.vet_info) : data.vet_info;
                name = info.name || '';
                address = info.address || '';
                phone = info.phone || '';
              } catch {
                name = data.vet_info;
              }
            }
            setVetData({ name, address, phone });
          } else {
            setVetData({ name: '', address: '', phone: '' });
          }
          vetDataLoadedRef.current = true;
        })
        .catch(() => setVetError('Fehler beim Laden der Tierarzt-Informationen!'))
        .finally(() => setVetLoading(false));
    }
  };

  // Cancel-Handler für Notfall-Bearbeitung
  const handleCancelEditEmergency = () => {
    setEditEmergency(false);
    // Lade die ursprünglichen Daten erneut
    emergencyDataLoadedRef.current = false;
    if (user && activeTab === 'einstellungen') {
      setEmergencyLoading(true);
      setEmergencyError(null);
      ownerPreferencesService.getPreferences(user.id)
        .then(({ data, error }) => {
          if (error) {
            setEmergencyError('Fehler beim Laden des Notfallkontakts!');
            setEmergencyData({ name: '', phone: '' });
          } else if (data) {
            setEmergencyData({
              name: data.emergency_contact_name || '',
              phone: data.emergency_contact_phone || ''
            });
          } else {
            setEmergencyData({ name: '', phone: '' });
          }
          emergencyDataLoadedRef.current = true;
        })
        .catch(() => setEmergencyError('Fehler beim Laden des Notfallkontakts!'))
        .finally(() => setEmergencyLoading(false));
    }
  };

  // Passwort ändern Handler
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setPasswordError(null);
    setPasswordSuccess(false);

    // Validierung
    if (!passwordData.currentPassword) {
      setPasswordError('Bitte gib dein aktuelles Passwort ein.');
      return;
    }

    if (!passwordData.newPassword) {
      setPasswordError('Bitte gib ein neues Passwort ein.');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.');
      return;
    }

    try {
      setPasswordLoading(true);

      // Erst das aktuelle Passwort verifizieren
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: passwordData.currentPassword
      });

      if (signInError) {
        setPasswordError('Das aktuelle Passwort ist nicht korrekt.');
        return;
      }

      // Neues Passwort setzen
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) {
        setPasswordError('Fehler beim Aktualisieren des Passworts: ' + updateError.message);
        return;
      }

      setPasswordSuccess(true);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Erfolg nach 3 Sekunden ausblenden
      setTimeout(() => setPasswordSuccess(false), 3000);

    } catch (error: any) {
      console.error('Fehler beim Ändern des Passworts:', error);
      setPasswordError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const ownerApprovalStatus =
    (userProfile?.owner_approval_status as string | undefined) ?? 'not_requested';

  const handleRequestOwnerApproval = async () => {
    if (!user || ownerApprovalLoading) return;
    setOwnerApprovalLoading(true);
    try {
      const { error } = await requestOwnerApproval(user.id);
      if (error) {
        showError('Freigabe', error, 6000);
        return;
      }
      updateProfileState({
        ...(userProfile || {}),
        owner_approval_status: 'pending',
        owner_approval_requested_at: new Date().toISOString()
      });
      showSuccess(
        'Profil eingereicht',
        'Wir prüfen dein Profilbild und geben dein öffentliches Profil sowie Gesuche frei.',
        6000
      );
    } catch (e) {
      showError('Fehler', e instanceof Error ? e.message : 'Unbekannter Fehler', 6000);
    } finally {
      setOwnerApprovalLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-6 sm:py-10">
      <div className="container-custom px-4 sm:px-6 lg:px-8">
        {/* Profil-Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col lg:flex-row items-start gap-5 sm:gap-6">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto lg:mx-0 group">
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl object-cover border-4 border-primary-100 shadow"
              />

              {/* Overlay für Edit-Button */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-xl flex items-center justify-center cursor-pointer"
                onClick={() => setShowImageCropper(true)}>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white rounded-full p-2 shadow-lg">
                  <Edit className="h-5 w-5 text-primary-600" />
                </div>
              </div>

              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                  <LoadingSpinner />
                </div>
              )}

              {avatarError && (
                <div className="absolute left-0 right-0 -bottom-8 text-xs text-red-500 text-center">
                  {avatarError}
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Erste Spalte: Name und Tiere (relative für Freigabe-Bereich rechts oben wie Caretaker) */}
                <div className="flex-1 text-center lg:text-left relative">
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-2 mb-4">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">{fullName}</h1>
                    {/* Auge-Icon neben dem Namen mit Hovereffekt */}
                    <div className="group relative">
                      <Link
                        to={`/owner/${user?.id}`}
                        className="inline-flex items-center justify-center w-6 h-6 text-primary-600 hover:text-primary-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <div className="absolute left-1/2 transform -translate-x-1/2 top-8 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        <div className="text-center">Zu meinem Profil</div>
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    </div>
                    {/* Crown-Icon für Premium-Status mit Hovereffekt */}
                    {userProfile?.premium_badge && (
                      <div className="group relative">
                        <div className="inline-flex items-center justify-center w-6 h-6 text-amber-500 hover:text-amber-600 transition-colors">
                          <Crown className="h-5 w-5" />
                        </div>
                        <div className="absolute left-1/2 transform -translate-x-1/2 top-8 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                          <div className="text-center">Premium Mitglied</div>
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                        </div>
                      </div>
                    )}
                    {/* Freigabe-Icon (Tierhalter) */}
                    <div className="group relative">
                      <div
                        className={`inline-flex items-center justify-center w-6 h-6 transition-colors ${
                          ownerApprovalStatus === 'approved'
                            ? 'text-green-500 hover:text-green-600'
                            : ownerApprovalStatus === 'pending'
                              ? 'text-yellow-500 hover:text-yellow-600'
                              : ownerApprovalStatus === 'rejected'
                                ? 'text-red-500 hover:text-red-600'
                                : 'text-gray-400 hover:text-gray-500'
                        }`}
                      >
                        {ownerApprovalStatus === 'approved' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : ownerApprovalStatus === 'pending' ? (
                          <Clock className="h-4 w-4" />
                        ) : ownerApprovalStatus === 'rejected' ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </div>
                      <div className="absolute left-1/2 transform -translate-x-1/2 top-8 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        <div className="text-center">
                          {ownerApprovalStatus === 'approved'
                            ? 'Profil freigegeben'
                            : ownerApprovalStatus === 'pending'
                              ? 'Freigabe ausstehend'
                              : ownerApprovalStatus === 'rejected'
                                ? 'Freigabe abgelehnt'
                                : 'Freigabe nicht angefordert'}
                        </div>
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    </div>
                  </div>

                  {/* Pet-Badges */}
                  <div className="flex flex-wrap justify-center lg:justify-start gap-2">
                    {pets.map((pet) => (
                      <span key={pet.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm bg-primary-50 text-primary-700 border border-primary-100">
                        <PawPrint className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />{pet.name} ({pet.type})
                      </span>
                    ))}
                  </div>

                  {/* Rechts oben: Freigabe-Button + Hinweis (Layout wie CaretakerDashboardPage) */}
                  {ownerApprovalStatus !== 'approved' && (
                    <div className="mt-4 lg:absolute lg:top-0 lg:right-0 flex flex-col items-center lg:items-end gap-2 w-full lg:w-auto">
                        {ownerApprovalStatus === 'pending' ? (
                          <button
                            type="button"
                            disabled
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-lg cursor-not-allowed"
                          >
                            <Clock className="h-4 w-4" />
                            Profil wird überprüft
                          </button>
                        ) : ownerApprovalStatus === 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => void handleRequestOwnerApproval()}
                            disabled={ownerApprovalLoading}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ownerApprovalLoading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                Wird gesendet...
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4" />
                                Erneut zur Freigabe geben
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleRequestOwnerApproval()}
                            disabled={ownerApprovalLoading}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 text-sm font-medium rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ownerApprovalLoading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                                Wird gesendet...
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4" />
                                Profil zur Freigabe geben
                              </>
                            )}
                          </button>
                        )}

                        {!approvalHintDismissed && (
                        <div
                          className="relative w-full max-w-md lg:max-w-sm rounded-lg border border-gray-100 bg-gray-50/90 py-3 pl-3 pr-10 text-left text-xs sm:text-sm text-gray-600 leading-relaxed"
                          role="region"
                          aria-label="Hinweis zur Profil-Sichtbarkeit"
                        >
                          <button
                            type="button"
                            onClick={() => setApprovalHintDismissed(true)}
                            className="absolute top-2 right-2 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                            aria-label="Hinweis schließen"
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                          <div className="flex gap-2">
                            <Info className="h-4 w-4 shrink-0 text-primary-600 mt-0.5" aria-hidden />
                            <div className="min-w-0 space-y-2 flex-1">
                              <p className="font-medium text-gray-800">Profil ist ohne Freigabe nicht öffentlich</p>
                              <p>
                                Ohne erfolgreiche Freigabe erscheint dein öffentliches Profil nicht und deine Gesuche sind
                                für andere nicht sichtbar.
                              </p>
                              {ownerApprovalStatus === 'pending' ? (
                                <p>
                                  Deine Anfrage wird geprüft. Bis zur Entscheidung bleiben Profil und Gesuche unsichtbar.
                                  Du erhältst eine Rückmeldung nach der Prüfung.
                                </p>
                              ) : (
                                <>
                                  <p>
                                    Fordere die Freigabe über den Button an – tigube prüft jedes Profilbild manuell, bevor
                                    es live geht.
                                  </p>
                                  <p className="font-medium text-gray-700">Voraussetzungen für die Einreichung:</p>
                                  <ul className="list-disc pl-4 space-y-0.5">
                                    <li>Profilbild hinterlegt (echtes Portrait)</li>
                                  </ul>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        )}
                    </div>
                  )}

                  {ownerApprovalStatus === 'rejected' && userProfile?.owner_approval_notes && (
                    <div className="mt-4 w-full">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-red-900 text-sm mb-2">Ablehnungsgrund:</div>
                            <div className="text-red-700 text-sm whitespace-pre-wrap">
                              {userProfile.owner_approval_notes}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Kontaktdaten entfernt – jetzt eigener Tab */}
              </div>
            </div>
          </div>
        </div>

        {/* Owner Dashboard Banner */}
        <div className="mb-6">
          <AdvertisementBanner
            placement="owner_dashboard"
            targetingOptions={{
              petTypes: userProfile?.pet_types || [],
              location: userProfile?.location || '',
              subscriptionType: subscription?.plan_type || 'free'
            }}
          />
        </div>

        {/* Sidebar-Navigation + Inhalt (Layout wie Caretaker-Dashboard) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 mb-8">
          <aside className="lg:col-span-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <nav
              className="bg-white rounded-xl shadow p-2 sm:p-4 lg:sticky lg:top-4 overflow-x-auto overscroll-x-contain scrollbar-hide pb-1 -mb-1 sm:pb-0 sm:mb-0 touch-pan-x"
              aria-label="Dashboard-Bereiche"
            >
              <ul className="flex flex-row lg:flex-col gap-2 lg:gap-0 lg:space-y-1 min-w-0">
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('uebersicht')}
                    aria-current={activeTab === 'uebersicht' ? 'page' : undefined}
                    className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'uebersicht'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                  >
                    <Heart className="h-4 w-4 shrink-0 opacity-80" />
                    Übersicht
                  </button>
                </li>
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('tiere')}
                    aria-current={activeTab === 'tiere' ? 'page' : undefined}
                    className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'tiere'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                  >
                    <PawPrint className="h-4 w-4 shrink-0 opacity-80" />
                    Meine Tiere
                  </button>
                </li>
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('oeffentlichesProfil')}
                    aria-current={activeTab === 'oeffentlichesProfil' ? 'page' : undefined}
                    className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'oeffentlichesProfil'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                  >
                    <User className="h-4 w-4 shrink-0 opacity-80" />
                    Öffentliches Profil
                  </button>
                </li>
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('jobs')}
                    aria-current={activeTab === 'jobs' ? 'page' : undefined}
                    className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'jobs'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                  >
                    <Briefcase className="h-4 w-4 shrink-0 opacity-80" />
                    Gesuche
                  </button>
                </li>
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('affiliate')}
                    aria-current={activeTab === 'affiliate' ? 'page' : undefined}
                    className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'affiliate'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                  >
                    <Share2 className="h-4 w-4 shrink-0 opacity-80" />
                    Affiliate Programm
                  </button>
                </li>
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('kontaktdaten')}
                    aria-current={activeTab === 'kontaktdaten' ? 'page' : undefined}
                    className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'kontaktdaten'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                  >
                    <BookUser className="h-4 w-4 shrink-0 opacity-80" />
                    Kontaktdaten
                  </button>
                </li>
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('einstellungen')}
                    aria-current={activeTab === 'einstellungen' ? 'page' : undefined}
                    className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'einstellungen'
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                  >
                    <Settings className="h-4 w-4 shrink-0 opacity-80" />
                    Einstellungen
                  </button>
                </li>
                {isPremiumUser && (
                  <li className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('mitgliedschaft')}
                      aria-current={activeTab === 'mitgliedschaft' ? 'page' : undefined}
                      className={`w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'mitgliedschaft'
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                        }`}
                    >
                      <Crown className="h-4 w-4 shrink-0 opacity-80" />
                      Mitgliedschaft
                    </button>
                  </li>
                )}
                <li className="shrink-0">
                  <Link
                    to="/hilfe-center"
                    className="w-auto lg:w-full flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50 border border-transparent"
                  >
                    <HelpCircle className="h-4 w-4 shrink-0 opacity-80" />
                    Hilfe-Center
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
          <section className="lg:col-span-3 min-w-0">
        {/* Tab Content */}
        {activeTab === 'uebersicht' && (
          <>
            {/* Kontakte */}
            <div className="mb-8">
              {/* Meine Betreuer (nur echte Betreuer aus Chats, nicht Favoriten) */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Meine Betreuer
                </h2>

                {contactsLoading ? (
                  <div className="text-gray-500">Betreuer werden geladen ...</div>
                ) : contactsError ? (
                  <div className="text-red-500">{contactsError}</div>
                ) : contacts.length === 0 ? (
                  <div className="text-gray-500">
                    Noch keine Betreuer gespeichert.
                    <br />
                    <span className="text-sm">Verwende den "Als Betreuer speichern" Button in einem Chat, um Betreuer hier anzuzeigen.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {contacts.map((caregiver: any) => (
                      <div key={caregiver.id} className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex gap-3 sm:gap-4 items-center relative min-h-[110px]">
                        {/* Action Icons oben rechts */}
                        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-1.5 sm:gap-2">
                          {/* Favoriten-Herz */}
                          {caregiver.isFavorite && (
                            <div className="text-primary-500" title="Favorit">
                              <Heart className="h-3.5 w-3.5 fill-current" />
                            </div>
                          )}
                          {/* Profil ansehen */}
                          <Link
                            to={caregiver.user_type && ['hundetrainer', 'tierarzt', 'tierfriseur', 'physiotherapeut', 'ernaehrungsberater', 'tierfotograf', 'sonstige'].includes(caregiver.user_type)
                              ? `/dienstleister/${caregiver.id}`
                              : `/betreuer/${caregiver.id}`}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                            title="Profil ansehen"
                          >
                            <User className="h-3.5 w-3.5" />
                          </Link>
                          {/* Chat öffnen */}
                          <button
                            type="button"
                            className="text-gray-400 hover:text-green-600 transition-colors"
                            title="Chat öffnen"
                            onClick={(e) => handleStartChat(caregiver, e)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                          {/* Betreuer entfernen */}
                          <button
                            type="button"
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            aria-label="Betreuer entfernen"
                            onClick={(e) => handleDeleteContact(caregiver, e)}
                            title="Betreuer entfernen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <img src={caregiver.avatar} alt={caregiver.name} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl object-cover border-2 border-primary-100" />
                        <div className="flex-1 min-w-0 pr-12 sm:pr-14">
                          <div className="flex items-center gap-2 mb-1 min-w-0">
                            <div className="font-bold text-base sm:text-lg truncate">{caregiver.name}</div>
                            {caregiver.isCommercial && (
                              <span className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md text-center flex items-center justify-center">
                                <Briefcase className="h-3 w-3 mr-1" /> Pro
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-gray-600 text-sm mt-1 mb-2 gap-1">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span className="truncate">{caregiver.location}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {caregiver.services.map((service: string) => (
                              <span key={service} className="inline-block bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Favoriten (nur favorisierte Betreuer, die NICHT als Betreuer gespeichert sind) */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Favoriten
                </h2>

                {favoritesLoading ? (
                  <div className="text-gray-500">Favoriten werden geladen ...</div>
                ) : favoritesError ? (
                  <div className="text-red-500">{favoritesError}</div>
                ) : favoriteCaretakers.length === 0 ? (
                  <div className="text-gray-500">
                    Noch keine Favoriten markiert.
                    <br />
                    <span className="text-sm">Verwende das Herz-Symbol auf Betreuer-Profilen, um Favoriten zu markieren.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {favoriteCaretakers.map((caregiver: any) => (
                      <div key={`fav-${caregiver.id}`} className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex gap-3 sm:gap-4 items-center relative min-h-[110px] border border-primary-100">
                        {/* Action Icons oben rechts */}
                        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-1.5 sm:gap-2">
                          {/* Favoriten-Herz (klickbar zum Entfernen) */}
                          <button
                            type="button"
                            className="text-primary-500 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Favorit entfernen"
                            onClick={(e) => handleRemoveFavorite(caregiver, e)}
                            disabled={removingFavoriteId === caregiver.id}
                          >
                            {removingFavoriteId === caregiver.id ? (
                              <div className="w-3.5 h-3.5 border border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Heart className="h-3.5 w-3.5 fill-current" />
                            )}
                          </button>
                          {/* Profil ansehen */}
                          <Link
                            to={caregiver.user_type && ['hundetrainer', 'tierarzt', 'tierfriseur', 'physiotherapeut', 'ernaehrungsberater', 'tierfotograf', 'sonstige'].includes(caregiver.user_type)
                              ? `/dienstleister/${caregiver.id}`
                              : `/betreuer/${caregiver.id}`}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                            title="Profil ansehen"
                          >
                            <User className="h-3.5 w-3.5" />
                          </Link>
                          {/* Chat öffnen */}
                          <button
                            type="button"
                            className="text-gray-400 hover:text-green-600 transition-colors"
                            title="Chat öffnen"
                            onClick={(e) => handleStartChat(caregiver, e)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <img src={caregiver.avatar} alt={caregiver.name} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl object-cover border-2 border-primary-100" />
                        <div className="flex-1 min-w-0 pr-12 sm:pr-14">
                          <div className="flex items-center gap-2 mb-1 min-w-0">
                            <div className="font-bold text-base sm:text-lg truncate">{caregiver.name}</div>
                            {caregiver.isCommercial && (
                              <span className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md text-center flex items-center justify-center">
                                <Briefcase className="h-3 w-3 mr-1" /> Pro
                              </span>
                            )}
                          </div>
                          {/* Dienstleistung Badge */}
                          {caregiver.kategorie_name && (
                            <div className="flex items-center gap-1 mb-2">
                              {caregiver.kategorie_icon && (
                                <DienstleisterCategoryIcon
                                  iconName={caregiver.kategorie_icon}
                                  size="sm"
                                  className={getCategoryColor(caregiver.kategorie_name)}
                                />
                              )}
                              <span className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-medium", getCategoryBgColor(caregiver.kategorie_name), getCategoryColor(caregiver.kategorie_name))}>
                                {caregiver.kategorie_name}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center text-gray-600 text-sm mt-1 mb-2 gap-1">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span className="truncate">{caregiver.location}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {caregiver.services
                              .filter((service: string) => !service.toLowerCase().includes('anfahr'))
                              .map((service: string) => (
                                <span key={service} className="inline-block bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                                  {service}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'oeffentlichesProfil' && (
          <>
            {/* Kurzvorstellung & Über mich (Tab: Öffentliches Profil) */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 mb-2">
                <Info className="h-5 w-5" />
                Kurzvorstellung
              </h3>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8 relative">
                {!editShortIntro && (
                  <button
                    type="button"
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-gray-400 hover:text-primary-600"
                    onClick={() => {
                      setEditShortIntro(true);
                      setShortIntroDraft(shortIntro);
                    }}
                    title="Bearbeiten"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                <p className="text-xs text-gray-500 mb-3 pr-10">
                  Erscheint oben auf deinem Tierhalter-Profil unter deinem Namen (max. {SHORT_INTRO_MAX} Zeichen).
                </p>
                {!editShortIntro ? (
                  <div className="text-gray-700 min-h-[32px] whitespace-pre-wrap break-words">
                    {shortIntro ? (
                      <span>{shortIntro}</span>
                    ) : (
                      <span className="text-gray-400">Noch keine Kurzvorstellung hinterlegt.</span>
                    )}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSaveShortIntro();
                    }}
                  >
                    <textarea
                      value={shortIntroDraft}
                      onChange={(e) => {
                        if (e.target.value.length <= SHORT_INTRO_MAX) {
                          setShortIntroDraft(e.target.value);
                        }
                      }}
                      placeholder="z. B. Zwei Hunde, viel Liebe zur Natur, suche verlässliche Betreuung …"
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      autoFocus
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-2">
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                          type="submit"
                          className="w-full sm:w-auto px-3 py-2.5 sm:py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs disabled:opacity-50 touch-manipulation"
                          disabled={aboutMeSaving || shortIntroDraft.length > SHORT_INTRO_MAX}
                        >
                          {aboutMeSaving ? 'Speichert...' : 'Speichern'}
                        </button>
                        <button
                          type="button"
                          className="w-full sm:w-auto px-3 py-2.5 sm:py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs touch-manipulation"
                          onClick={() => {
                            setEditShortIntro(false);
                            setShortIntroDraft(shortIntro);
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                      <span
                        className={`text-xs shrink-0 ${shortIntroDraft.length > SHORT_INTRO_MAX ? 'text-red-500' : 'text-gray-500'}`}
                      >
                        {shortIntroDraft.length} / {SHORT_INTRO_MAX} Zeichen
                      </span>
                    </div>
                  </form>
                )}
              </div>

              <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 mb-2">
                <User className="h-5 w-5" />
                Über mich
              </h3>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 relative">
                {!editAboutMe && (
                  <button
                    type="button"
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-gray-400 hover:text-primary-600"
                    onClick={() => {
                      setEditAboutMe(true);
                      setAboutMeDraft(aboutMe);
                    }}
                    title="Bearbeiten"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                <p className="text-xs text-gray-500 mb-3 pr-10">
                  Ausführlicher Text im Bereich „Über mich“ auf deinem Profil (max. {ABOUT_ME_MAX} Zeichen).
                </p>
                {!editAboutMe ? (
                  <div className="text-gray-700 min-h-[32px] whitespace-pre-wrap break-words">
                    {aboutMe ? (
                      <span>{aboutMe}</span>
                    ) : (
                      <span className="text-gray-400">Noch kein Text hinterlegt.</span>
                    )}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSaveAboutMeSection();
                    }}
                  >
                    <textarea
                      value={aboutMeDraft}
                      onChange={(e) => {
                        if (e.target.value.length <= ABOUT_ME_MAX) {
                          setAboutMeDraft(e.target.value);
                        }
                      }}
                      placeholder="Erzähle mehr über dich, deine Tiere und was dir bei der Betreuung wichtig ist …"
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      autoFocus
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-2">
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                          type="submit"
                          className="w-full sm:w-auto px-3 py-2.5 sm:py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs disabled:opacity-50 touch-manipulation"
                          disabled={aboutMeSaving}
                        >
                          {aboutMeSaving ? 'Speichert...' : 'Speichern'}
                        </button>
                        <button
                          type="button"
                          className="w-full sm:w-auto px-3 py-2.5 sm:py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs touch-manipulation"
                          onClick={() => {
                            setEditAboutMe(false);
                            setAboutMeDraft(aboutMe);
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {aboutMeDraft.length} / {ABOUT_ME_MAX} Zeichen
                      </span>
                    </div>
                  </form>
                )}
              </div>

              {aboutMeSuccess && (
                <div className="mt-4 text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Erfolgreich gespeichert!
                </div>
              )}
              {aboutMeError && (
                <div className="mt-2 text-sm text-red-600">{aboutMeError}</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'affiliate' && (
          <RefGrowDashboard email={user.email || ''} />
        )}

        {activeTab === 'kontaktdaten' && (
          <OwnerContactTab />
        )}

        {activeTab === 'tiere' && (
          <>
            {/* Haustiere */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><PawPrint className="h-5 w-5" />Meine Tiere</h2>
              {petsLoading ? (
                <div className="text-gray-500">Tiere werden geladen ...</div>
              ) : petError ? (
                <div className="text-red-500">{petError}</div>
              ) : pets.length === 0 ? (
                <div className="text-gray-500 italic">Hier ist noch gähnende Leere…  Füge jetzt dein erstes Tier hinzu!</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                  {pets.map((pet) => (
                    <div key={pet.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative hover:shadow-md transition-shadow duration-200">
                      {editPet !== pet.id ? (
                        <>
                          {/* Edit-Button oben rechts */}
                          <button
                            type="button"
                            className="absolute top-3 right-3 p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200"
                            aria-label="Tier bearbeiten"
                            onClick={() => handleEditPet(pet)}
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          {/* Header mit Foto und Name */}
                          <div className="flex items-center gap-4 mb-4">
                            {pet.image ? (
                              <img
                                src={pet.image}
                                alt={pet.name}
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-primary-100 shadow-sm"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 border-2 border-primary-100 flex items-center justify-center text-primary-600 shadow-sm">
                                {pet.name ? (
                                  <span className="text-xl font-bold">{pet.name.charAt(0).toUpperCase()}</span>
                                ) : (
                                  <PawPrint className="h-6 w-6" />
                                )}
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="font-bold text-xl text-gray-900 mb-1">{pet.name}</h3>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                  {pet.type}
                                </span>
                                {pet.breed && (
                                  <span className="text-gray-500 text-sm">• {pet.breed}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Tier-Details in Grid */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Alter</div>
                              <div className="text-sm font-semibold text-gray-900">{pet.birthDate ? calculateAge(pet.birthDate) : '—'} Jahre</div>
                            </div>
                            {pet.weight && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Gewicht</div>
                                <div className="text-sm font-semibold text-gray-900">{pet.weight} kg</div>
                              </div>
                            )}
                            {pet.gender && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Geschlecht</div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {pet.gender}
                                  {pet.neutered && <span className="text-gray-500 ml-1">(kastriert)</span>}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Beschreibung */}
                          {pet.description && (
                            <div className="border-t border-gray-100 pt-3">
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Über {pet.name}</div>
                              <p className="text-sm text-gray-700 leading-relaxed" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {pet.description}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="space-y-3">
                            <div>
                              <PetPhotoUploader
                                photoUrl={editPetData.image}
                                onEditClick={handleEditPetPhotoClick}
                                uploading={petImageUploading}
                              />
                            </div>
                            <input
                              type="text"
                              className="input w-full"
                              placeholder="Name"
                              value={editPetData.name}
                              onChange={e => setEditPetData(p => ({ ...p, name: e.target.value }))}
                            />
                            <select
                              className="input w-full"
                              value={editPetData.type}
                              onChange={e => setEditPetData(p => ({ ...p, type: e.target.value, typeOther: '' }))}
                            >
                              <option value="">Art auswählen</option>
                              <option value="Hund">Hund</option>
                              <option value="Katze">Katze</option>
                              <option value="Vogel">Vogel</option>
                              <option value="Kaninchen">Kaninchen</option>
                              <option value="Andere">Andere</option>
                            </select>
                            {editPetData.type === 'Andere' && (
                              <input
                                type="text"
                                className="input w-full"
                                placeholder="Bitte Tierart angeben"
                                value={editPetData.typeOther}
                                onChange={e => setEditPetData(p => ({ ...p, typeOther: e.target.value }))}
                              />
                            )}
                            <input
                              type="text"
                              className="input w-full"
                              placeholder="Rasse"
                              value={editPetData.breed}
                              onChange={e => setEditPetData(p => ({ ...p, breed: e.target.value }))}
                            />
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
                              <input
                                type="date"
                                className="input w-full"
                                value={editPetData.birthDate}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => setEditPetData(p => ({ ...p, birthDate: e.target.value }))}
                              />
                            </div>
                            <input
                              type="number"
                              className="input w-full"
                              placeholder="Gewicht (kg)"
                              value={editPetData.weight}
                              onChange={e => setEditPetData(p => ({ ...p, weight: e.target.value }))}
                            />
                            <textarea
                              className="input w-full"
                              placeholder="Über das Tier (Charakter, Besonderheiten, etc.)"
                              value={editPetData.description}
                              onChange={e => setEditPetData(p => ({ ...p, description: e.target.value }))}
                              rows={3}
                            />
                            {editPetData.type === 'Hund' && (
                              <div className="flex gap-4 items-center mt-2">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Geschlecht</label>
                                  <select
                                    className="input"
                                    value={editPetData.gender || ''}
                                    onChange={e => setEditPetData(p => ({ ...p, gender: e.target.value as 'Rüde' | 'Hündin' }))}
                                  >
                                    <option value="">Auswählen</option>
                                    <option value="Rüde">Rüde</option>
                                    <option value="Hündin">Hündin</option>
                                  </select>
                                </div>
                                <div className="flex items-center mt-6">
                                  <input
                                    type="checkbox"
                                    id="neutered-edit"
                                    checked={!!editPetData.neutered}
                                    onChange={e => setEditPetData(p => ({ ...p, neutered: e.target.checked }))}
                                    className="mr-2"
                                  />
                                  <label htmlFor="neutered-edit" className="text-sm">kastriert/sterilisiert</label>
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                                onClick={handleSavePet}
                                disabled={!editPetData.name.trim()}
                              >
                                <Check className="h-4 w-4 inline mr-1" /> Speichern
                              </button>
                              <button
                                type="button"
                                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                                onClick={() => setEditPet(null)}
                              >
                                <X className="h-4 w-4 inline mr-1" /> Abbrechen
                              </button>
                            </div>
                          </div>

                          {/* Delete-Button unten rechts */}
                          <button
                            type="button"
                            className="absolute bottom-4 right-4 text-red-400 hover:text-red-600 transition-colors"
                            aria-label="Tier löschen"
                            onClick={() => handleDeletePet(pet.id)}
                          >
                            <Trash className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                {!showAddPet ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 text-primary-600 hover:underline text-sm"
                    onClick={() => setShowAddPet(true)}
                  >
                    <Plus className="h-4 w-4" /> Weiteres Tier hinzufügen
                  </button>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm p-4 mt-4 flex flex-col gap-2 max-w-md">
                    <input
                      type="text"
                      className="input"
                      placeholder="Name"
                      value={newPet.name}
                      onChange={e => setNewPet(p => ({ ...p, name: e.target.value }))}
                    />
                    <select
                      className="input"
                      value={newPet.type}
                      onChange={e => setNewPet(p => ({ ...p, type: e.target.value, typeOther: '' }))}
                    >
                      <option value="">Art auswählen</option>
                      <option value="Hund">Hund</option>
                      <option value="Katze">Katze</option>
                      <option value="Vogel">Vogel</option>
                      <option value="Kaninchen">Kaninchen</option>
                      <option value="Andere">Andere</option>
                    </select>
                    {newPet.type === 'Andere' && (
                      <input
                        type="text"
                        className="input mt-2"
                        placeholder="Bitte Tierart angeben"
                        value={newPet.typeOther}
                        onChange={e => setNewPet(p => ({ ...p, typeOther: e.target.value }))}
                      />
                    )}
                    <input
                      type="text"
                      className="input"
                      placeholder="Rasse"
                      value={newPet.breed}
                      onChange={e => setNewPet(p => ({ ...p, breed: e.target.value }))}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
                      <input
                        type="date"
                        className="input"
                        value={newPet.birthDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => setNewPet(p => ({ ...p, birthDate: e.target.value }))}
                      />
                    </div>
                    <input
                      type="number"
                      className="input"
                      placeholder="Gewicht (kg)"
                      value={newPet.weight}
                      onChange={e => setNewPet(p => ({ ...p, weight: e.target.value }))}
                    />
                    <textarea
                      className="input"
                      placeholder="Über das Tier (Charakter, Besonderheiten, etc.)"
                      value={newPet.description}
                      onChange={e => setNewPet(p => ({ ...p, description: e.target.value }))}
                      rows={3}
                    />
                    {newPet.type === 'Hund' && (
                      <div className="flex gap-4 items-center mt-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Geschlecht</label>
                          <select
                            className="input"
                            value={newPet.gender || ''}
                            onChange={e => setNewPet(p => ({ ...p, gender: e.target.value as 'Rüde' | 'Hündin' }))}
                          >
                            <option value="">Auswählen</option>
                            <option value="Rüde">Rüde</option>
                            <option value="Hündin">Hündin</option>
                          </select>
                        </div>
                        <div className="flex items-center mt-6">
                          <input
                            type="checkbox"
                            id="neutered-new"
                            checked={!!newPet.neutered}
                            onChange={e => setNewPet(p => ({ ...p, neutered: e.target.checked }))}
                            className="mr-2"
                          />
                          <label htmlFor="neutered-new" className="text-sm">kastriert/sterilisiert</label>
                        </div>
                      </div>
                    )}
                    <PetPhotoUploader
                      photoUrl={newPet.image}
                      onEditClick={handleNewPetPhotoClick}
                      uploading={petImageUploading}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                        onClick={handleAddPet}
                        disabled={!newPet.name.trim() || !newPet.type.trim() || (newPet.type === 'Andere' && !newPet.typeOther.trim())}
                      >
                        <Check className="h-4 w-4 inline" /> Speichern
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        onClick={() => { setShowAddPet(false); setNewPet({ name: '', type: '', typeOther: '', breed: '', birthDate: '', weight: '', image: '', description: '', gender: '', neutered: false }); }}
                      >
                        <X className="h-4 w-4 inline" /> Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'jobs' && user && (
          <OwnerDashboardJobsTab
            userId={user.id}
            pets={pets.map((p) => ({ id: p.id, name: p.name }))}
            isPremiumUser={isPremiumUser}
            ownerApprovalStatus={ownerApprovalStatus}
            onGoToOverview={() => setActiveTab('uebersicht')}
          />
        )}

        {activeTab === 'einstellungen' && (
          <>
            {/* Tierarzt-Informationen und Notfallkontakt */}
            <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tierarzt-Informationen */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Shield className="h-5 w-5" />Tierarzt-Informationen</h2>
                <div className="bg-white rounded-xl shadow-sm p-4 text-gray-600 relative">
                  {/* Edit-Button oben rechts */}
                  {!editVet && (
                    <button
                      type="button"
                      className="absolute top-4 right-4 text-gray-400 hover:text-primary-600 transition-colors"
                      aria-label="Tierarzt-Informationen bearbeiten"
                      onClick={() => setEditVet(true)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {vetLoading ? (
                    <div className="text-gray-500">Tierarzt-Informationen werden geladen ...</div>
                  ) : vetError ? (
                    <div className="text-red-500">{vetError}</div>
                  ) : !editVet ? (
                    <>
                      <div className="mb-2"><span className="font-medium">Name:</span> {vetData.name || '—'}</div>
                      <div className="mb-2"><span className="font-medium">Adresse:</span> {vetData.address || '—'}</div>
                      <div className="mb-2"><span className="font-medium">Telefon:</span> {vetData.phone || '—'}</div>
                      {vetSaveMsg && <div className="text-green-600 text-sm mt-2">{vetSaveMsg}</div>}
                    </>
                  ) : (
                    <>
                      <div className="mb-2">
                        <span className="font-medium">Name:</span>
                        <input type="text" className="input mt-1" value={vetData.name} onChange={e => setVetData(d => ({ ...d, name: e.target.value }))} />
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Adresse:</span>
                        <input type="text" className="input mt-1" value={vetData.address} onChange={e => setVetData(d => ({ ...d, address: e.target.value }))} />
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Telefon:</span>
                        <input
                          type="tel"
                          className="input mt-1"
                          value={vetData.phone}
                          onChange={e => setVetData(d => ({ ...d, phone: e.target.value }))}
                          placeholder="+49 123 456789"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm" onClick={handleSaveVet} disabled={vetLoading}>Speichern</button>
                        <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm" onClick={handleCancelEditVet} disabled={vetLoading}>Abbrechen</button>
                      </div>
                      {vetSaveMsg && <div className="text-green-600 text-sm mt-2">{vetSaveMsg}</div>}
                    </>
                  )}
                </div>
              </div>

              {/* Notfallkontakt */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Phone className="h-5 w-5" />Notfallkontakt</h2>
                <div className="bg-white rounded-xl shadow-sm p-4 text-gray-600 relative">
                  {/* Edit-Button oben rechts */}
                  {!editEmergency && (
                    <button
                      type="button"
                      className="absolute top-4 right-4 text-gray-400 hover:text-primary-600 transition-colors"
                      aria-label="Notfallkontakt bearbeiten"
                      onClick={() => setEditEmergency(true)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {emergencyLoading ? (
                    <div className="text-gray-500">Notfallkontakt wird geladen ...</div>
                  ) : emergencyError ? (
                    <div className="text-red-500">{emergencyError}</div>
                  ) : !editEmergency ? (
                    <>
                      <div className="mb-2"><span className="font-medium">Name:</span> {emergencyData.name || '—'}</div>
                      <div><span className="font-medium">Telefon:</span> {emergencyData.phone || '—'}</div>
                      {emergencySaveMsg && <div className="text-green-600 text-sm mt-2">{emergencySaveMsg}</div>}
                    </>
                  ) : (
                    <>
                      <div className="mb-2">
                        <span className="font-medium">Name:</span>
                        <input type="text" className="input mt-1" value={emergencyData.name} onChange={e => setEmergencyData(d => ({ ...d, name: e.target.value }))} />
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Telefon:</span>
                        <input
                          type="tel"
                          className="input mt-1"
                          value={emergencyData.phone}
                          onChange={e => setEmergencyData(d => ({ ...d, phone: e.target.value }))}
                          placeholder="+49 123 456789"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm" onClick={handleSaveEmergency} disabled={emergencyLoading}>Speichern</button>
                        <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm" onClick={handleCancelEditEmergency} disabled={emergencyLoading}>Abbrechen</button>
                      </div>
                      {emergencySaveMsg && <div className="text-green-600 text-sm mt-2">{emergencySaveMsg}</div>}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Betreuungsvorlieben */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Betreuungsvorlieben
              </h2>
              <div className="bg-white rounded-xl shadow-sm p-4 relative">
                {/* Edit-Button oben rechts */}
                {!editPrefs && (
                  <button
                    type="button"
                    className="absolute top-4 right-4 text-gray-400 hover:text-primary-600 transition-colors"
                    aria-label="Betreuungsvorlieben bearbeiten"
                    onClick={handleEditPrefs}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
                {prefsLoading ? (
                  <div className="text-gray-500">Betreuungsvorlieben werden geladen ...</div>
                ) : prefsError ? (
                  <div className="text-red-500">{prefsError}</div>
                ) : !editPrefs ? (
                  <>
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-3">Gewünschte Services</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {OWNER_SERVICE_TAGS.map((service) => (
                          <label key={service} className="flex items-center space-x-3">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={services.includes(service)}
                                disabled
                                className="sr-only"
                              />
                              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${services.includes(service)
                                ? 'bg-green-600 border-green-600'
                                : 'bg-white border-gray-300'
                                }`}>
                                {services.includes(service) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                            <span className="text-gray-700">{service}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-3">Sonstige Wünsche</h3>
                      {otherWishes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {otherWishes.map((wish, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700"
                            >
                              {wish}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {prefsSaveMsg && <span className="text-green-600 text-sm mt-2">{prefsSaveMsg}</span>}
                  </>
                ) : (
                  <>
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-3">Gewünschte Services</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {OWNER_SERVICE_TAGS.map((service) => (
                          <label key={service} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editServices.includes(service)}
                              onChange={() => handleEditServiceToggle(service)}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            />
                            <span className="text-gray-700">{service}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-3">Sonstige Wünsche</h3>
                      {editOtherWishes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {editOtherWishes.map((wish, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700"
                            >
                              {wish}
                              <button
                                type="button"
                                className="ml-2 text-primary-500 hover:text-primary-700"
                                onClick={() => handleEditRemoveOtherWish(idx)}
                                aria-label={`${wish} entfernen`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="input flex-1"
                          placeholder="Neuen Wunsch eingeben..."
                          value={editNewOtherWish}
                          onChange={(e) => {
                            setEditNewOtherWish(e.target.value);
                            setEditOtherWishError(null);
                          }}
                          onKeyDown={handleEditOtherWishKeyDown}
                        />
                        <button
                          type="button"
                          className="p-2 text-green-600 hover:text-green-700 disabled:opacity-50"
                          onClick={handleEditAddOtherWish}
                          disabled={!editNewOtherWish.trim()}
                          aria-label="Wunsch hinzufügen"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setEditNewOtherWish('');
                            setEditOtherWishError(null);
                          }}
                          aria-label="Eingabe löschen"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {editOtherWishError && (
                        <p className="text-red-500 text-sm mt-1">{editOtherWishError}</p>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                        onClick={handleSaveEditPrefs}
                        disabled={!prefsChanged || prefsLoading}
                      >
                        {prefsLoading ? 'Speichern...' : 'Speichern'}
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        onClick={handleCancelEditPrefs}
                        disabled={prefsLoading}
                      >
                        Abbrechen
                      </button>
                      {prefsSaveMsg && <span className="text-green-600 text-sm mt-2">{prefsSaveMsg}</span>}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Informationen teilen */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Informationen mit Betreuern teilen
              </h2>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-sm min-w-0">
                      <p className="font-medium text-blue-800">Datenschutz-Hinweis</p>
                      <p className="text-blue-700 mt-1">
                        Wähle aus, welche Informationen du mit deinen Betreuern teilen möchtest.
                        Diese Einstellungen gelten für alle aktuellen und zukünftigen Betreuer-Kontakte.
                        Deine Daten werden nur mit den von dir ausgewählten Betreuern geteilt und sind durch unsere Datenschutzrichtlinien geschützt.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Profilbild</h4>
                      <p className="text-sm text-gray-500">Dein Profilbild auf deinem öffentlichen Profil anzeigen</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.profilePhoto}
                        onChange={() => handleShareToggle('profilePhoto')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Kurzvorstellung &amp; Über mich</h4>
                      <p className="text-sm text-gray-500">
                        Kurzvorstellung (Hero) und ausführlichen „Über-mich“-Text auf deinem öffentlichen Profil anzeigen
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.aboutMe}
                        onChange={() => handleShareToggle('aboutMe')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Telefonnummer</h4>
                      <p className="text-sm text-gray-500">Ermöglicht direkten Kontakt in Notfällen</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.phoneNumber}
                        onChange={() => handleShareToggle('phoneNumber')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">E-Mail-Adresse</h4>
                      <p className="text-sm text-gray-500">Für schriftliche Kommunikation und Updates</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.email}
                        onChange={() => handleShareToggle('email')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Adresse</h4>
                      <p className="text-sm text-gray-500">PLZ und Ort für lokale Betreuung</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.address}
                        onChange={() => handleShareToggle('address')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Tierarzt-Informationen</h4>
                      <p className="text-sm text-gray-500">Wichtig für medizinische Notfälle</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.vetInfo}
                        onChange={() => handleShareToggle('vetInfo')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Notfallkontakt</h4>
                      <p className="text-sm text-gray-500">Alternative Ansprechperson in Notfällen</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.emergencyContact}
                        onChange={() => handleShareToggle('emergencyContact')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Tier-Details</h4>
                      <p className="text-sm text-gray-500">Alter, Rasse und besondere Eigenschaften</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.petDetails}
                        onChange={() => handleShareToggle('petDetails')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3">
                    <div className="min-w-0 flex-1 pr-2 sm:pr-4">
                      <h4 className="font-medium text-gray-900">Betreuungsvorlieben</h4>
                      <p className="text-sm text-gray-500">Gewünschte Services und spezielle Wünsche</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer self-end sm:self-auto shrink-0">
                      <input
                        type="checkbox"
                        checked={shareSettings.carePreferences}
                        onChange={() => handleShareToggle('carePreferences')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                {/* Status-Nachrichten */}
                {shareSettingsLoading && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-700 text-sm">Datenschutz-Einstellungen werden gespeichert...</p>
                  </div>
                )}
                {shareSettingsError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{shareSettingsError}</p>
                  </div>
                )}
                {shareSettingsSaveMsg && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-700 text-sm">{shareSettingsSaveMsg}</p>
                  </div>
                )}
              </div>
            </div>

            {/* E-Mail-Adresse ändern */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5" />
                E-Mail-Adresse ändern
              </h2>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setEmailChangeError(null);
                    setEmailChangeSuccess(null);
                    setEmailChangeLoading(true);
                    // Validierung
                    if (!newEmail.trim() || !currentPasswordForEmail.trim()) {
                      setEmailChangeError('Bitte fülle alle Felder aus.');
                      setEmailChangeLoading(false);
                      return;
                    }
                    if (!validateEmail(newEmail)) {
                      setEmailChangeError('Bitte gib eine gültige E-Mail-Adresse ein.');
                      setEmailChangeLoading(false);
                      return;
                    }
                    if (newEmail.trim() === user?.email) {
                      setEmailChangeError('Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden.');
                      setEmailChangeLoading(false);
                      return;
                    }
                    // Passwort prüfen und E-Mail ändern
                    try {
                      // 1. Passwort prüfen
                      const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: user.email!,
                        password: currentPasswordForEmail
                      });
                      if (signInError) {
                        setEmailChangeError('Das aktuelle Passwort ist nicht korrekt.');
                        setEmailChangeLoading(false);
                        return;
                      }
                      // 2. E-Mail ändern
                      const { error: updateError } = await supabase.auth.updateUser({
                        email: newEmail.trim()
                      });
                      if (updateError) {
                        setEmailChangeError('Fehler beim Ändern der E-Mail-Adresse: ' + updateError.message);
                        setEmailChangeLoading(false);
                        return;
                      }
                      setEmailChangeSuccess('E-Mail-Änderung eingeleitet! Bitte bestätige die Änderung über den Link, der an deine alte E-Mail-Adresse gesendet wurde.');
                      setNewEmail('');
                      setCurrentPasswordForEmail('');
                    } catch (err: any) {
                      setEmailChangeError('Ein unerwarteter Fehler ist aufgetreten.');
                    } finally {
                      setEmailChangeLoading(false);
                    }
                  }}
                  className="space-y-6"
                >
                  {/* Hinweis in gelblicher Box */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-1">Wichtiger Hinweis</p>
                        <p>
                          Die Bestätigung der Änderung wird an deine <strong>alte E-Mail-Adresse</strong> gesendet
                          und muss dort bestätigt werden, bevor die neue E-Mail-Adresse aktiv wird.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Links: Aktuelle E-Mail */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Aktuelle E-Mail</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          E-Mail-Adresse
                        </label>
                        <input
                          type="email"
                          className="input w-full bg-gray-100 cursor-not-allowed"
                          value={user?.email || ''}
                          disabled
                        />
                      </div>
                    </div>

                    {/* Rechts: Neue E-Mail + Passwort */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Neue E-Mail</h3>
                      <div className="space-y-4">
                        {/* Neue E-Mail */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Neue E-Mail-Adresse <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            className="input w-full"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            placeholder="neue@email.de"
                            required
                          />
                        </div>

                        {/* Aktuelles Passwort */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Aktuelles Passwort <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            className="input w-full"
                            value={currentPasswordForEmail}
                            onChange={e => setCurrentPasswordForEmail(e.target.value)}
                            placeholder="Dein aktuelles Passwort"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fehler und Erfolg */}
                  {emailChangeError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {emailChangeError}
                    </div>
                  )}

                  {emailChangeSuccess && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <Check className="h-4 w-4" />
                      {emailChangeSuccess}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex justify-start">
                    <button
                      type="submit"
                      className="btn btn-primary py-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={emailChangeLoading}
                    >
                      {emailChangeLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Wird geändert...
                        </div>
                      ) : (
                        'E-Mail ändern'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Passwort ändern */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Passwort ändern
              </h2>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Links: Aktuelles Passwort */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Aktuelles Passwort</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Aktuelles Passwort <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.current ? 'text' : 'password'}
                            className="input pr-10 w-full"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                            placeholder="Dein aktuelles Passwort"
                            disabled={passwordLoading}
                            required
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                            tabIndex={-1}
                          >
                            {showPasswords.current ? (
                              <EyeOff className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Eye className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Rechts: Neues Passwort */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Neues Passwort</h3>
                      <div className="space-y-4">
                        {/* Neues Passwort */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Neues Passwort <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.new ? 'text' : 'password'}
                              className="input pr-10 w-full"
                              value={passwordData.newPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                              placeholder="Mindestens 8 Zeichen"
                              disabled={passwordLoading}
                              required
                              minLength={8}
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                              tabIndex={-1}
                            >
                              {showPasswords.new ? (
                                <EyeOff className="h-5 w-5 text-gray-400" />
                              ) : (
                                <Eye className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Passwort bestätigen */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Neues Passwort bestätigen <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.confirm ? 'text' : 'password'}
                              className="input pr-10 w-full"
                              value={passwordData.confirmPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              placeholder="Neues Passwort wiederholen"
                              disabled={passwordLoading}
                              required
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                              tabIndex={-1}
                            >
                              {showPasswords.confirm ? (
                                <EyeOff className="h-5 w-5 text-gray-400" />
                              ) : (
                                <Eye className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fehler und Erfolg */}
                  {passwordError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <Check className="h-4 w-4" />
                      Passwort erfolgreich geändert!
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex justify-start">
                    <button
                      type="submit"
                      className="btn btn-primary py-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Wird geändert...
                        </div>
                      ) : (
                        'Passwort ändern'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Konto löschen */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Konto löschen
              </h2>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-red-200">
                <div className="bg-red-50 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-red-800">Achtung - Irreversible Aktion</p>
                      <p className="text-red-700 mt-1">
                        Das Löschen deines Kontos ist endgültig und kann nicht rückgängig gemacht werden.
                        Alle deine Daten, Haustier-Profile und Betreuungsverläufe werden endgültig entfernt.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Was wird gelöscht:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                    <li>Dein Benutzerprofil und alle persönlichen Daten</li>
                    <li>Alle Haustier-Profile und deren Fotos</li>
                    <li>Betreuungsvorlieben und Einstellungen</li>
                    <li>Tierarzt- und Notfallkontaktinformationen</li>
                    <li>Kommunikationsverlauf mit Betreuern</li>
                    <li>Alle Bewertungen und Feedback</li>
                  </ul>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  {!showDeleteConfirmation ? (
                    <button
                      type="button"
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                      onClick={() => setShowDeleteConfirmation(true)}
                    >
                      Konto löschen
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-800 font-medium mb-2">
                          Bist du sicher, dass du dein Konto löschen möchtest?
                        </p>
                        <p className="text-yellow-700 text-sm">
                          Gib zur Bestätigung "KONTO LÖSCHEN" in das Feld unten ein:
                        </p>
                      </div>

                      <input
                        type="text"
                        className="input w-full max-w-xs"
                        placeholder="KONTO LÖSCHEN"
                        value={deleteConfirmationText}
                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      />

                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmationText !== 'KONTO LÖSCHEN' || isDeleting}
                        >
                          {isDeleting ? 'Wird gelöscht...' : 'Endgültig löschen'}
                        </button>
                        <button
                          type="button"
                          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          onClick={() => {
                            setShowDeleteConfirmation(false);
                            setDeleteConfirmationText('');
                          }}
                          disabled={isDeleting}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'mitgliedschaft' && (
          <>
            {/* Mitgliedschaft Management */}
            <div className="space-y-6">
              {/* Premium Status Card */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Premium Mitgliedschaft</h2>
                      <p className="text-sm text-gray-600">Aktiv seit {subscription?.created_at ? new Date(subscription.created_at).toLocaleDateString('de-DE') : 'Unbekannt'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      Aktiv
                    </div>
                    {subscription?.plan_expires_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        Verlängert sich am {new Date(subscription.plan_expires_at).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-blue-600">Unlimited</div>
                    <div className="text-sm text-gray-600">Kontaktanfragen</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border">
                    <div className="text-2xl font-bold text-green-600">Werbefrei</div>
                    <div className="text-sm text-gray-600">Erfahrung</div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="primary"
                    onClick={() => {
                      // Öffne Stripe Customer Portal
                      const customerPortalUrl = 'https://billing.stripe.com/p/login/test_00w9AU8GVfV897Q8gJ2oE00';
                      window.open(customerPortalUrl, '_blank');
                    }}
                    className="flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Mitgliedschaft verwalten
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/mitgliedschaften')}
                    className="flex items-center gap-2"
                  >
                    <Star className="w-4 h-4" />
                    Plan-Details ansehen
                  </Button>
                </div>
              </div>

              {/* Premium Features Overview */}
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Deine Premium Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">Unlimited Kontaktanfragen an Betreuer</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">Erweiterte Suchfilter verwenden</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">Bewertungen für Betreuer schreiben</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">Werbefreie Nutzung der Plattform</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">Premium Badge im Profil</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">Prioritärer Kundenservice</span>
                  </div>
                </div>
              </div>

              {/* Billing History Preview */}
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Rechnungshistorie</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const customerPortalUrl = 'https://billing.stripe.com/p/login/test_00w9AU8GVfV897Q8gJ2oE00';
                      window.open(customerPortalUrl, '_blank');
                    }}
                  >
                    Alle Rechnungen anzeigen
                  </Button>
                </div>
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Detaillierte Rechnungshistorie verfügbar im</p>
                  <p className="font-medium">Stripe Kundenportal</p>
                </div>
              </div>
            </div>
          </>
        )}
          </section>
        </div>

      </div>

      {/* Delete Caretaker Confirmation Modal */}
      {showDeleteCaretakerModal && caretakerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Betreuer entfernen</h2>
            </div>

            <p className="text-gray-700 mb-4 leading-relaxed">
              Möchtest du <span className="font-medium">{caretakerToDelete.name}</span> wirklich entfernen?
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Was passiert beim Entfernen:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li>Die Verbindung zwischen euch wird gelöscht</li>
                    <li>Ihr seht euch nicht mehr in den jeweiligen Listen</li>
                    <li>Geteilte Kontaktdaten werden verborgen</li>
                    <li>Der Chat-Verlauf bleibt bestehen</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gib zur Bestätigung "BETREUER ENTFERNEN" ein:
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="BETREUER ENTFERNEN"
                value={deleteCaretakerConfirmationText}
                onChange={(e) => setDeleteCaretakerConfirmationText(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDeleteCaretakerConfirm}
                disabled={deleteCaretakerConfirmationText !== 'BETREUER ENTFERNEN'}
              >
                Endgültig entfernen
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                onClick={handleDeleteCaretakerCancel}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Success Modal */}
      <PaymentSuccessModal
        isOpen={paymentSuccess.isOpen}
        onClose={closeModal}
        planType={paymentSuccess.planType}
        userType={paymentSuccess.userType}
        sessionData={paymentSuccess.sessionData}
      />

      {/* Registration Onboarding Modal */}
      <RegistrationSuccessModal
        isOpen={showOnboarding}
        userType="owner"
        userName={onboardingUserName}
        onComplete={() => setShowOnboarding(false)}
        onSkip={() => setShowOnboarding(false)}
      />

      {/* Profilbild Editor Modal */}
      {showImageCropper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Profilbild bearbeiten</h2>
                <button
                  onClick={() => setShowImageCropper(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <ProfileImageCropper
                photoUrl={avatarUrl}
                onImageSave={handleCroppedImageSave}
                uploading={avatarUploading}
                error={avatarError}
                infoText={"Lade bitte ein nettes Profilbild von Dir hoch – das schafft Vertrauen! 😊\n\nWichtig für Deine Freischaltung: Ein echtes Portrait (Gesicht gut erkennbar). Bitte keine KI-Bilder, Avatare, Sonnenbrillen oder weitere Personen."}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Pet Image Editor Modal */}
      {showPetImageCropper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {petCropperMode === 'new' ? 'Tierfoto für neues Tier' : 'Tierfoto bearbeiten'}
                </h2>
                <button
                  onClick={() => setShowPetImageCropper(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <ProfileImageCropper
                photoUrl={petCropperMode === 'new' ? getPetImageUrl(newPet.image) : getPetImageUrl(editPetData.image)}
                onImageSave={handlePetCroppedImageSave}
                uploading={petImageUploading}
                error={petImageError}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      <DashboardReleaseTeaser />
    </div>
  );
}

export default OwnerDashboardPage; 