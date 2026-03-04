import { useEffect, useState } from "react";
import {
    getFbAccounts,
    createFbAccount,
    deleteFbAccount,
    loginFbAccount,
    logoutFbAccount,
    checkFbAccountStatus,
    saveFbAccountCookies,
    setFbAccountActive,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Plus,
    KeyRound,
    LogOut,
    Trash2,
    Loader2,
    Cookie,
    Star,
    Shield,
    ShieldCheck,
    Globe,
} from "lucide-react";

interface FbAccount {
    _id: string;
    email: string;
    name: string;
    status: "active" | "inactive" | "error";
    isActive: boolean;
    hasPassword: boolean;
    hasCookies: boolean;
    lastLoginAt: string | null;
    lastCheckedAt: string | null;
    error: string;
    createdAt: string;
}

export default function FbAccountsPage() {
    const [accounts, setAccounts] = useState<FbAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showCookieDialog, setShowCookieDialog] = useState<string | null>(null);
    const [show2FADialog, setShow2FADialog] = useState<string | null>(null);
    const [twoFACode, setTwoFACode] = useState("");
    const [twoFASessionId, setTwoFASessionId] = useState<string | null>(null);
    const [twoFALoading, setTwoFALoading] = useState(false);
    const [form, setForm] = useState({ email: "", password: "" });
    const [cookieText, setCookieText] = useState("");

    const fetchAccounts = async () => {
        try {
            const res = await getFbAccounts();
            const data = (res as unknown as { data: FbAccount[] })?.data || res;
            setAccounts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching accounts:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleAdd = async () => {
        if (!form.email || !form.password) return;
        try {
            await createFbAccount(form);
            setForm({ email: "", password: "" });
            setShowAddDialog(false);
            fetchAccounts();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            alert(error?.response?.data?.message || "Error creating account");
        }
    };

    const withAction = async (key: string, fn: () => Promise<unknown>) => {
        setActionLoading(key);
        try {
            await fn();
            fetchAccounts();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            alert(error?.response?.data?.message || "Action failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveCookies = async () => {
        if (!showCookieDialog || !cookieText.trim()) return;
        await withAction(`cookie-${showCookieDialog}`, () =>
            saveFbAccountCookies(showCookieDialog, cookieText.trim()),
        );
        setCookieText("");
        setShowCookieDialog(null);
    };

    const handleInteractiveLogin = async (accountId: string) => {
        setActionLoading(`ilogin-${accountId}`);
        try {
            const res = await fetch(`/api/fb-accounts/${accountId}/interactive-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();

            if (data.success) {
                fetchAccounts();
            } else if (data.requiresTwoFactor && data.sessionId) {
                setTwoFASessionId(data.sessionId);
                setShow2FADialog(accountId);
                setTwoFACode("");
            } else {
                alert(data.error || data.message || "Dang nhap that bai");
                fetchAccounts();
            }
        } catch (err) {
            console.error(err);
            alert("Loi ket noi server");
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmit2FA = async () => {
        if (!show2FADialog || !twoFASessionId || !twoFACode.trim()) return;
        setTwoFALoading(true);
        try {
            const res = await fetch(`/api/fb-accounts/${show2FADialog}/submit-2fa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: twoFASessionId, code: twoFACode.trim() }),
            });
            const data = await res.json();

            if (data.success) {
                setShow2FADialog(null);
                setTwoFASessionId(null);
                setTwoFACode("");
                fetchAccounts();
            } else {
                alert(data.error || "Ma 2FA khong dung");
            }
        } catch (err) {
            console.error(err);
            alert("Loi ket noi server");
        } finally {
            setTwoFALoading(false);
        }
    };

    const statusBadge = (account: FbAccount) => {
        if (account.status === "active" && account.hasCookies) {
            return (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    Connected
                </Badge>
            );
        }
        if (account.status === "error") {
            return (
                <Badge variant="destructive" className="text-xs">
                    Error
                </Badge>
            );
        }
        return (
            <Badge variant="secondary" className="text-xs">
                Disconnected
            </Badge>
        );
    };

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleString("vi-VN");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Facebook Accounts</h1>
                        <p className="text-sm text-muted-foreground">
                            Quan ly tai khoan Facebook de scan va comment
                        </p>
                    </div>

                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Them Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Them tai khoan Facebook</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <Input
                                        type="password"
                                        placeholder="Facebook password"
                                        value={form.password}
                                        onChange={(e) =>
                                            setForm({ ...form, password: e.target.value })
                                        }
                                    />
                                </div>
                                <Button onClick={handleAdd} className="w-full">
                                    Them Account
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Cookie dialog */}
                <Dialog
                    open={!!showCookieDialog}
                    onOpenChange={(open) => {
                        if (!open) {
                            setShowCookieDialog(null);
                            setCookieText("");
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Login bang Cookies</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p>Cach lay cookies tu Chrome:</p>
                                <ol className="list-decimal list-inside space-y-1 text-xs">
                                    <li>Mo facebook.com tren Chrome (da login)</li>
                                    <li>
                                        F12 &rarr; Application &rarr; Cookies &rarr; facebook.com
                                    </li>
                                </ol>
                            </div>
                            <div className="space-y-2">
                                <Label>Paste cookies</Label>
                                <Textarea
                                    placeholder="c_user=123; xs=abc; fr=xyz; ..."
                                    value={cookieText}
                                    onChange={(e) => setCookieText(e.target.value)}
                                    rows={4}
                                />
                            </div>
                            <Button
                                onClick={handleSaveCookies}
                                className="w-full"
                                disabled={
                                    !cookieText.trim() || actionLoading?.startsWith("cookie-")
                                }
                            >
                                {actionLoading?.startsWith("cookie-") ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Cookie className="h-4 w-4 mr-2" />
                                )}
                                Luu Cookies
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>


                {/* Account list */}
                {accounts.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <p className="text-muted-foreground mb-4">
                                Chua co tai khoan Facebook nao
                            </p>
                            <Button onClick={() => setShowAddDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Them Account dau tien
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                Danh sach tai khoan ({accounts.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {accounts.map((account) => {
                                    const isConnected =
                                        account.status === "active" && account.hasCookies;
                                    return (
                                        <div
                                            key={account._id}
                                            className={`flex items-center gap-4 px-6 py-4 transition-colors ${account.isActive
                                                ? "bg-primary/5 border-l-2 border-l-primary"
                                                : "hover:bg-muted/50"
                                                }`}
                                        >
                                            {/* Active indicator */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() =>
                                                            withAction(`active-${account._id}`, () =>
                                                                setFbAccountActive(account._id),
                                                            )
                                                        }
                                                        disabled={
                                                            actionLoading === `active-${account._id}`
                                                        }
                                                        className={`shrink-0 p-1 rounded-full transition-colors ${account.isActive
                                                            ? "text-yellow-500"
                                                            : "text-muted-foreground/30 hover:text-yellow-500/60"
                                                            }`}
                                                    >
                                                        <Star
                                                            className={`h-5 w-5 ${account.isActive ? "fill-yellow-500" : ""}`}
                                                        />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {account.isActive
                                                        ? "Tai khoan dang su dung"
                                                        : "Chon lam tai khoan chinh"}
                                                </TooltipContent>
                                            </Tooltip>

                                            {/* Account info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium truncate">
                                                        {account.email}
                                                    </span>
                                                    {statusBadge(account)}
                                                    {account.isActive && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs border-yellow-500/50 text-yellow-500"
                                                        >
                                                            Dang dung
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                                    {account.name && <span>{account.name}</span>}
                                                    <span>Login: {formatDate(account.lastLoginAt)}</span>
                                                </div>
                                                {account.error && (
                                                    <p className="text-xs text-destructive mt-1 truncate">
                                                        {account.error}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Action icons */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {!isConnected && (
                                                    <>
                                                        {/* Auto Login */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8"
                                                                    onClick={() =>
                                                                        withAction(`login-${account._id}`, () =>
                                                                            loginFbAccount(account._id),
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        actionLoading === `login-${account._id}`
                                                                    }
                                                                >
                                                                    {actionLoading === `login-${account._id}` ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <KeyRound className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Dang nhap</TooltipContent>
                                                        </Tooltip>

                                                        {/* Interactive Login (ho tro 2FA) */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8"
                                                                    onClick={() =>
                                                                        handleInteractiveLogin(account._id)
                                                                    }
                                                                    disabled={
                                                                        actionLoading === `ilogin-${account._id}`
                                                                    }
                                                                >
                                                                    {actionLoading === `ilogin-${account._id}` ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Globe className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Dang nhap (ho tro 2FA)</TooltipContent>
                                                        </Tooltip>

                                                        {/* Cookies */}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8"
                                                                    onClick={() =>
                                                                        setShowCookieDialog(account._id)
                                                                    }
                                                                >
                                                                    <Cookie className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Login bang Cookies</TooltipContent>
                                                        </Tooltip>
                                                    </>
                                                )}

                                                {/* Logout */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className={`h-8 w-8 ${!isConnected ? "opacity-30 cursor-not-allowed" : ""}`}
                                                            onClick={() =>
                                                                withAction(`logout-${account._id}`, () =>
                                                                    logoutFbAccount(account._id),
                                                                )
                                                            }
                                                            disabled={
                                                                !isConnected ||
                                                                actionLoading === `logout-${account._id}`
                                                            }
                                                        >
                                                            {actionLoading === `logout-${account._id}` ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <LogOut className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {isConnected ? "Dang xuat" : "Chua dang nhap"}
                                                    </TooltipContent>
                                                </Tooltip>

                                                {/* Check status */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            onClick={() =>
                                                                withAction(`check-${account._id}`, () =>
                                                                    checkFbAccountStatus(account._id),
                                                                )
                                                            }
                                                            disabled={
                                                                actionLoading === `check-${account._id}`
                                                            }
                                                        >
                                                            {actionLoading === `check-${account._id}` ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : isConnected ? (
                                                                <ShieldCheck className="h-4 w-4 text-green-500" />
                                                            ) : (
                                                                <Shield className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Kiem tra trang thai</TooltipContent>
                                                </Tooltip>

                                                {/* Delete */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                                            onClick={() => {
                                                                if (confirm("Xac nhan xoa account nay?")) {
                                                                    withAction(`del-${account._id}`, () =>
                                                                        deleteFbAccount(account._id),
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Xoa tai khoan</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* 2FA Dialog */}
                <Dialog
                    open={!!show2FADialog}
                    onOpenChange={(open) => {
                        if (!open) {
                            setShow2FADialog(null);
                            setTwoFASessionId(null);
                            setTwoFACode("");
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Xac thuc 2 buoc (2FA)</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Facebook yeu cau ma xac thuc. Nhap ma tu ung dung xac thuc
                                (Google Authenticator, Authy, ...) hoac SMS.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="2fa-code">Ma xac thuc</Label>
                                <Input
                                    id="2fa-code"
                                    placeholder="Nhap ma 6 so"
                                    value={twoFACode}
                                    onChange={(e) => setTwoFACode(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSubmit2FA();
                                    }}
                                    maxLength={8}
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShow2FADialog(null);
                                        setTwoFASessionId(null);
                                        setTwoFACode("");
                                    }}
                                >
                                    Huy
                                </Button>
                                <Button
                                    onClick={handleSubmit2FA}
                                    disabled={!twoFACode.trim() || twoFALoading}
                                >
                                    {twoFALoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Xac nhan
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Phien xac thuc se het han sau 5 phut.
                            </p>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
