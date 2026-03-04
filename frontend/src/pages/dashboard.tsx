import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Users, Home, FileText, MessageSquare, Brain, Loader2, Scan } from "lucide-react";
import * as api from "@/lib/api";

interface Stats {
    total: number;
    analyzed: number;
    matched: number;
    commented: number;
}

interface Group {
    _id: string;
    name: string;
    autoScan: boolean;
}

interface Room {
    _id: string;
    isActive: boolean;
}

interface Post {
    _id: string;
    content: string;
    status: string;
    groupId?: { name: string };
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats>({ total: 0, analyzed: 0, matched: 0, commented: 0 });
    const [groups, setGroups] = useState<Group[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [scanning, setScanning] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const [statsRes, groupsRes, roomsRes, postsRes] = await Promise.allSettled([
            api.getPostStats(),
            api.getGroups(),
            api.getRooms(),
            api.getPosts("limit=5"),
        ]);
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (groupsRes.status === "fulfilled") setGroups(groupsRes.value.data);
        if (roomsRes.status === "fulfilled") setRooms(roomsRes.value.data);
        if (postsRes.status === "fulfilled") setPosts(postsRes.value.data);
    }

    const handleScan = async () => {
        setScanning(true);
        setScanResult(null);
        try {
            const res = await api.startScan();
            const data = (res as unknown as Record<string, Record<string, string>>);
            setScanResult(data?.data?.message || "Scan started!");
            // Reload data sau 3s
            setTimeout(() => { loadData(); setScanResult(null); }, 5000);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setScanResult(error?.response?.data?.message || "Scan failed");
        } finally {
            setScanning(false);
        }
    };

    const handleAnalyze = async () => {
        setAnalyzing(true);
        setAnalyzeResult(null);
        try {
            const res = await api.analyzePosts(20);
            const d = ((res as unknown as Record<string, Record<string, number>>)?.data || res) as Record<string, number>;
            setAnalyzeResult(`Analyzed: ${d.analyzed}, Matched: ${d.matched}, Skipped: ${d.skipped}`);
            setTimeout(() => { loadData(); setAnalyzeResult(null); }, 5000);
        } catch (err: unknown) {
            const error = err as { message?: string };
            setAnalyzeResult(error?.message || "Analyze failed");
        } finally {
            setAnalyzing(false);
        }
    };

    const statCards = [
        { title: "Total Groups", value: groups.length, icon: Users, color: "text-blue-500" },
        { title: "Active Rooms", value: rooms.filter((r) => r.isActive).length, icon: Home, color: "text-green-500" },
        { title: "Posts Scanned", value: stats.total, icon: FileText, color: "text-purple-500" },
        { title: "Comments Posted", value: stats.commented, icon: MessageSquare, color: "text-orange-500" },
    ];

    const statusVariant = (status: string) => {
        const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            matched: "default",
            commented: "secondary",
            new: "outline",
            analyzed: "secondary",
            skipped: "outline",
        };
        return map[status] || "outline";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <div className="flex items-center gap-2">
                    <Button onClick={handleScan} disabled={scanning}>
                        {scanning ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Scan className="mr-2 h-4 w-4" />
                        )}
                        Scan Groups
                    </Button>
                    <Button variant="outline" onClick={handleAnalyze} disabled={analyzing}>
                        {analyzing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Brain className="mr-2 h-4 w-4" />
                        )}
                        AI Analyze
                    </Button>
                </div>
            </div>

            {(scanResult || analyzeResult) && (
                <div className="p-3 rounded-lg bg-muted text-sm">
                    {scanResult && <p>Scan: {scanResult}</p>}
                    {analyzeResult && <p>AI: {analyzeResult}</p>}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((s) => (
                    <Card key={s.title}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {s.title}
                            </CardTitle>
                            <s.icon className={`h-4 w-4 ${s.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{s.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle className="text-base">Recent Scanned Posts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {posts.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No posts scanned yet
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Content</TableHead>
                                        <TableHead>Group</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {posts.map((post) => (
                                        <TableRow key={post._id}>
                                            <TableCell className="max-w-[200px] truncate text-sm">
                                                {post.content?.substring(0, 60)}...
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {post.groupId?.name || "--"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(post.status)}>
                                                    {post.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-base">Quick Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Analyzed Posts</span>
                            <span className="text-sm font-semibold">{stats.analyzed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Matched Posts</span>
                            <span className="text-sm font-semibold text-green-500">{stats.matched}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Comments Posted</span>
                            <span className="text-sm font-semibold text-blue-500">{stats.commented}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Groups with Auto Scan</span>
                            <span className="text-sm font-semibold">
                                {groups.filter((g) => g.autoScan).length}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
