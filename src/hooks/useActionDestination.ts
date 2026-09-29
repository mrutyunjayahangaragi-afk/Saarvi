"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  globalActionController,
  revealDestination,
  ActionState,
  RevealDestinationOptions,
  ACTION_DESTINATION_MAP,
} from "@/lib/ux/action-destination";

interface UseActionDestinationOptions {
  actionKey: string;
  targetId?: string;
  fallbackTarget?: string;
  focus?: boolean;
}

export function useActionDestination(options: UseActionDestinationOptions) {
  const { actionKey, targetId, fallbackTarget, focus } = options;
  const [state, setState] = useState<ActionState>("IDLE");
  const currentOpIdRef = useRef<string | null>(null);

  const start = useCallback(() => {
    const opId = globalActionController.startAction(actionKey);
    currentOpIdRef.current = opId;
    setState("PROCESSING");
    return opId;
  }, [actionKey]);

  const complete = useCallback(
    (customOptions?: Partial<RevealDestinationOptions>) => {
      let opId = currentOpIdRef.current;
      if (!opId) {
        opId = globalActionController.startAction(actionKey);
        currentOpIdRef.current = opId;
      }

      const result = globalActionController.completeAction(opId, {
        target: targetId,
        fallbackTarget,
        focus,
        ...customOptions,
      });

      if (result.offscreen) {
        setState("READY_OFFSCREEN");
      } else if (result.revealed) {
        setState("REVEALED");
      } else {
        setState("SUCCESS");
      }

      return result;
    },
    [actionKey, targetId, fallbackTarget, focus]
  );

  const fail = useCallback(
    (errorTarget?: string, customOptions?: Partial<RevealDestinationOptions>) => {
      let opId = currentOpIdRef.current;
      if (!opId) {
        opId = globalActionController.startAction(actionKey);
        currentOpIdRef.current = opId;
      }

      const revealed = globalActionController.failAction(opId, errorTarget, customOptions);
      setState("ERROR");
      return revealed;
    },
    [actionKey]
  );

  const reveal = useCallback(
    (customTarget?: string, customOptions?: Partial<RevealDestinationOptions>) => {
      const config = ACTION_DESTINATION_MAP[actionKey];
      return revealDestination({
        target: customTarget || targetId || config?.primaryTarget || "#tool-result",
        fallbackTarget: fallbackTarget || config?.fallbackTarget,
        focus: focus ?? config?.focus ?? true,
        behavior: "smooth",
        force: true, // User explicitly clicked View Result
        ...customOptions,
      });
    },
    [actionKey, targetId, fallbackTarget, focus]
  );

  return {
    state,
    startAction: start,
    completeAction: complete,
    failAction: fail,
    reveal,
    currentOpId: currentOpIdRef.current,
  };
}
