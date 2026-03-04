import { useState, useCallback, createContext, useContext } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

type AlertType = "success" | "error" | "warning" | "info";

interface AlertState {
    open: boolean;
    title: string;
    message: string;
    type: AlertType;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
}

const defaultState: AlertState = {
    open: false,
    title: "",
    message: "",
    type: "info",
};

interface AlertContextType {
    showAlert: (message: string, type?: AlertType, title?: string) => void;
    showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

const AlertContext = createContext<AlertContextType>({
    showAlert: () => { },
    showConfirm: () => { },
});

export function useAlert() {
    return useContext(AlertContext);
}

const iconMap: Record<AlertType, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const iconColorMap: Record<AlertType, string> = {
    success: "text-green-500",
    error: "text-destructive",
    warning: "text-yellow-500",
    info: "text-blue-500",
};

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AlertState>(defaultState);

    const showAlert = useCallback(
        (message: string, type: AlertType = "info", title?: string) => {
            setState({
                open: true,
                title: title || (type === "success" ? "Thanh cong" : type === "error" ? "Loi" : "Thong bao"),
                message,
                type,
                showCancel: false,
            });
        },
        [],
    );

    const showConfirm = useCallback(
        (message: string, onConfirm: () => void, title?: string) => {
            setState({
                open: true,
                title: title || "Xac nhan",
                message,
                type: "warning",
                onConfirm,
                confirmText: "Xac nhan",
                cancelText: "Huy",
                showCancel: true,
            });
        },
        [],
    );

    const handleClose = () => setState(defaultState);
    const handleConfirm = () => {
        state.onConfirm?.();
        setState(defaultState);
    };

    const Icon = iconMap[state.type];

    return (
        <AlertContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            <Dialog open={state.open} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${iconColorMap[state.type]}`} />
                            {state.title}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground py-2">{state.message}</p>
                    <DialogFooter>
                        {state.showCancel && (
                            <Button variant="outline" onClick={handleClose}>
                                {state.cancelText || "Huy"}
                            </Button>
                        )}
                        <Button
                            onClick={state.showCancel ? handleConfirm : handleClose}
                            variant={state.type === "error" ? "destructive" : "default"}
                        >
                            {state.showCancel ? state.confirmText || "Xac nhan" : "OK"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AlertContext.Provider>
    );
}
