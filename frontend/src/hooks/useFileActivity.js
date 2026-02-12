import { useEffect, useState } from "react";

/**
 * Hook to track viewing/editing activity for a specific file
 * Returns { viewing, editing }
 */
export function useFileActivity(awareness, fileId) {
  const [activity, setActivity] = useState({ viewing: 0, editing: 0 });

  useEffect(() => {
    if (!awareness || !fileId) {
      setActivity({ viewing: 0, editing: 0 });
      return;
    }

    const updateActivity = () => {
      let viewing = 0;
      let editing = 0;

      for (const [, state] of awareness.getStates()) {
        const currentFileId = state?.currentFileId;
        const isTyping = state?.editing === true;

        if (currentFileId === fileId) {
          viewing++;
          if (isTyping) editing++;
        }
      }

      setActivity({ viewing, editing });
    };

    updateActivity();
    awareness.on("update", updateActivity);
    awareness.on("change", updateActivity);

    return () => {
      awareness.off("update", updateActivity);
      awareness.off("change", updateActivity);
    };
  }, [awareness, fileId]);

  return activity;
}

/**
 * Hook to track activity for ALL files at once
 * Returns Map<fileId, {viewing, editing}>
 */
export function useAllFileActivity(awareness) {
  const [allActivity, setAllActivity] = useState(new Map());

  useEffect(() => {
    if (!awareness) {
      setAllActivity(new Map());
      return;
    }

    const updateActivity = () => {
      const activityMap = new Map();

      for (const [, state] of awareness.getStates()) {
        const currentFileId = state?.currentFileId;
        const isTyping = state?.editing === true;

        if (!currentFileId) continue;

        if (!activityMap.has(currentFileId)) {
          activityMap.set(currentFileId, { viewing: 0, editing: 0 });
        }

        const activity = activityMap.get(currentFileId);
        activity.viewing++;
        if (isTyping) activity.editing++;
      }

      setAllActivity(activityMap);
    };

    updateActivity();
    awareness.on("update", updateActivity);
    awareness.on("change", updateActivity);

    return () => {
      awareness.off("update", updateActivity);
      awareness.off("change", updateActivity);
    };
  }, [awareness]);

  return allActivity;
}

