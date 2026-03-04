import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import * as api from "@/lib/api";

interface Group {
    _id: string;
    name: string;
    url: string;
    description: string;
    autoScan: boolean;
    autoPost: boolean;
    isActive: boolean;
    lastScannedAt: string | null;
}

interface GroupForm {
    name: string;
    url: string;
    description: string;
    autoScan: boolean;
    autoPost: boolean;
}

const defaultForm: GroupForm = {
    name: "",
    url: "",
    description: "",
    autoScan: false,
    autoPost: false,
};

export default function Groups() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Group | null>(null);
    const [form, setForm] = useState<GroupForm>(defaultForm);

    useEffect(() => {
        loadGroups();
    }, []);

    async function loadGroups() {
        try {
            const res = await api.getGroups();
            setGroups(res.data);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditing(null);
        setForm(defaultForm);
        setOpen(true);
    }

    function openEdit(group: Group) {
        setEditing(group);
        setForm({
            name: group.name,
            url: group.url,
            description: group.description || "",
            autoScan: group.autoScan,
            autoPost: group.autoPost,
        });
        setOpen(true);
    }

    async function handleSubmit() {
        if (editing) {
            await api.updateGroup(editing._id, form);
        } else {
            await api.createGroup(form);
        }
        setOpen(false);
        loadGroups();
    }

    async function handleDelete(id: string) {
        if (!confirm("Ban co chac muon xoa group nay?")) return;
        await api.deleteGroup(id);
        loadGroups();
    }

    async function handleToggleScan(id: string) {
        await api.toggleScan(id);
        loadGroups();
    }

    function timeAgo(date: string | null) {
        if (!date) return "—";
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    if (loading) {
        return <div className="text-center text-muted-foreground py-12">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Group Management</h1>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Group
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>URL</TableHead>
                                <TableHead>Auto Scan</TableHead>
                                <TableHead>Auto Post</TableHead>
                                <TableHead>Last Scanned</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        No groups added yet
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groups.map((group) => (
                                    <TableRow key={group._id}>
                                        <TableCell className="font-medium">{group.name}</TableCell>
                                        <TableCell>
                                            <a
                                                href={group.url}
                                                target="_blank"
                                                rel="noopener"
                                                className="text-blue-500 hover:underline text-sm truncate block max-w-[200px]"
                                            >
                                                {group.url?.substring(0, 40)}...
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={group.autoScan}
                                                onCheckedChange={() => handleToggleScan(group._id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={group.autoPost ? "default" : "outline"}>
                                                {group.autoPost ? "On" : "Off"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {timeAgo(group.lastScannedAt)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={group.isActive ? "default" : "secondary"}>
                                                {group.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(group)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(group._id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Group" : "Add New Group"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Group Name</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ten nhom Facebook"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Group URL</Label>
                            <Input
                                value={form.url}
                                onChange={(e) => setForm({ ...form, url: e.target.value })}
                                placeholder="https://facebook.com/groups/..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Auto Scan</Label>
                            <Switch
                                checked={form.autoScan}
                                onCheckedChange={(v) => setForm({ ...form, autoScan: v })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Auto Post</Label>
                            <Switch
                                checked={form.autoPost}
                                onCheckedChange={(v) => setForm({ ...form, autoPost: v })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editing ? "Update" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
