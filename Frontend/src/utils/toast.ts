import { toast } from 'sonner';
import { getErrorMessage } from '../services/apiClient';

/**
 * Awaits a backend save. On success runs onSuccess (usually a toast); on failure shows the backend
 * message and runs onError (usually restoring the previous state).
 */
export const saveWithFeedback = async (
  save: Promise<unknown>,
  onSuccess: () => void,
  onError?: () => void
): Promise<boolean> => {
  try {
    await save;
    onSuccess();
    return true;
  } catch (error) {
    showToast.error(getErrorMessage(error));
    onError?.();
    return false;
  }
};

export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 3500,
    });
  },
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 4500,
    });
  },
  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 3000,
    });
  },
  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
    });
  },
  promise: <T>(
    promise: Promise<T>,
    loadingMsg: string,
    successMsg: string | ((data: T) => string),
    errorMsg: string
  ) => {
    return toast.promise(promise, {
      loading: loadingMsg,
      success: successMsg,
      error: errorMsg,
    });
  },
};
